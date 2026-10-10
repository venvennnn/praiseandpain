import type { HeadToHead } from "@/server/analysis/head-to-head";

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export type InsightFacts = {
  place: string;
  classifiedReviews: number;
  praiseCount: number;
  painCount: number;
  plainCount: number;
  praiseRate: number | null;
  painRate: number | null;
  topPain: Array<{ name: string; complaintShare: number; mentions: number }>;
  topPraise: Array<{ name: string; praiseShare: number; mentions: number }>;
  praiseShiftPercentagePoints: number | null;
  painShiftPercentagePoints: number | null;
  praiseShiftWindow: string | null;
  painShiftWindow: string | null;
  categoryPainMoves: Array<{ name: string; percentagePoints: number; from: string; to: string }>;
};

export async function writeComparisonBrief(input: {
  ourName: string;
  head: HeadToHead;
  themeLabels: Record<string, string>;
}): Promise<string> {
  const facts = {
    you: input.ourName,
    competitor: input.head.competitorName,
    yourPraiseRate: input.head.ourPraiseRate,
    yourPainRate: input.head.ourPainRate,
    yourClassifiedReviews: input.head.ourSampled,
    theirPraiseRate: input.head.theirPraiseRate,
    theirPainRate: input.head.theirPainRate,
    theirClassifiedReviews: input.head.theirSampled,
    praiseAdvantagePercentagePoints: input.head.praiseAdvantagePp,
    painAdvantagePercentagePoints: input.head.painAdvantagePp,
    themes: input.head.themes
      .filter((theme) => theme.stance !== "thin")
      .slice(0, 8)
      .map((theme) => ({
        name: input.themeLabels[theme.key] ?? theme.key,
        stance: theme.stance,
        early: theme.early,
        sharedPain: theme.sharedPain,
        yourMentions: theme.ourMentions,
        theirMentions: theme.theirMentions,
        yourPainShare: theme.ourPain,
        theirPainShare: theme.theirPain,
        yourPraiseShare: theme.ourPraise,
        theirPraiseShare: theme.theirPraise,
        painAdvantagePercentagePoints: theme.painAdvantagePp,
        praiseAdvantagePercentagePoints: theme.praiseAdvantagePp,
      })),
    calculatedLines: input.head.lines,
  };

  return generate([
    "Write a competitor briefing for the owner of the first place.",
    "Line 1 is a single headline that names the largest pain or praise gap and its percentage-point figure from the JSON.",
    "If a rate is missing, or every gap is under 8 percentage points, the headline says the comparison is still close or incomplete.",
    "Then two short paragraphs. Name the themes whose stance is ahead, behind, or sharedPain. Mention the mention counts.",
    "If a theme is early, say the sample is small. Skip thin themes.",
    "Use only the JSON facts. Do not invent reviews, causes, percentages, or sample sizes.",
    "No bullet list. No markdown headings.",
    JSON.stringify(facts),
  ]);
}

export async function writeInsightBrief(facts: InsightFacts): Promise<string> {
  return generate([
    "Write a feedback briefing for the owner of this place.",
    "Line 1 is a priority headline. Name the pain theme with the highest complaint share, and include that share and its mention count.",
    "If topPain is empty, the headline says classification is still waiting and does not invent a priority.",
    "Then one paragraph: praise rate, pain rate, classified review count, the strongest praise theme, and the largest category or sentiment move when those fields are present.",
    "A positive painShiftPercentagePoints means negative reviews became more common. A negative one means they became less common.",
    "Use only the JSON facts. Do not invent quotes, causes, or numbers that are not in the JSON.",
    "No bullet list. No markdown headings.",
    JSON.stringify(facts),
  ]);
}

async function generate(lines: string[]): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: lines.join("\n\n") }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${detail.slice(0, 240)}`);
  }
  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty brief");
  return text;
}
