import type { HeadToHead } from "@/server/analysis/head-to-head";

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function writeComparisonBrief(input: {
  ourName: string;
  head: HeadToHead;
  themeLabels: Record<string, string>;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
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
    themes: input.head.themes.map((theme) => ({
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
    })),
    calculatedLines: input.head.lines,
  };

  const prompt = [
    "Write a competitor brief for a business owner.",
    "Use only the JSON facts. Do not invent reviews, causes, percentages, or sample sizes.",
    "If a theme is thin or early, say the sample is small.",
    "Do not claim a winner when the stance is close, split, or thin.",
    "Two short paragraphs. No headings. No bullet list.",
    JSON.stringify(facts),
  ].join("\n\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
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
