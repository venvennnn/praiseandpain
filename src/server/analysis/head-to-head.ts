export type ThemeMetric = {
  key: string;
  mentions: number;
  praiseShare: number | null;
  painShare: number | null;
};

export type PlaceProfile = {
  id: string;
  name: string;
  praiseRate: number | null;
  painRate: number | null;
  sampled: number;
  themes: ThemeMetric[];
};

export type ThemeStance = "ahead" | "behind" | "split" | "close" | "thin";

export type ThemeComparison = {
  key: string;
  ourMentions: number;
  theirMentions: number;
  ourPain: number | null;
  theirPain: number | null;
  ourPraise: number | null;
  theirPraise: number | null;
  /** Their pain share minus yours, in percentage points. Positive means you have less pain. */
  painAdvantagePp: number | null;
  /** Your praise share minus theirs, in percentage points. Positive means you have more praise. */
  praiseAdvantagePp: number | null;
  stance: ThemeStance;
  sharedPain: boolean;
  early: boolean;
};

export type HeadToHead = {
  competitorId: string;
  competitorName: string;
  ourPraiseRate: number | null;
  theirPraiseRate: number | null;
  ourPainRate: number | null;
  theirPainRate: number | null;
  ourSampled: number;
  theirSampled: number;
  praiseAdvantagePp: number | null;
  painAdvantagePp: number | null;
  themes: ThemeComparison[];
  lines: string[];
};

const MIN_MENTIONS = 5;
const CLEAR_MENTIONS = 15;
const GAP_PP = 8;
const SHARED_PAIN = 0.35;

export function profileFromSnapshot(input: {
  id: string;
  name: string;
  metrics?: Record<
    string,
    {
      praise_share?: { value?: number | null; denominator?: number | null; status?: string } | null;
      complaint_share?: { value?: number | null; denominator?: number | null; status?: string } | null;
    }
  > | null;
  coverage?: {
    verdicts?: { praise?: number; pain?: number; mixed?: number; plain?: number };
    sampled?: number;
  } | null;
}): PlaceProfile {
  const verdicts = input.coverage?.verdicts;
  const praise = verdicts?.praise ?? 0;
  const pain = verdicts?.pain ?? 0;
  const mixed = verdicts?.mixed ?? 0;
  const plain = verdicts?.plain ?? 0;
  const total = praise + pain + mixed + plain;
  const themes = Object.entries(input.metrics ?? {})
    .map(([key, metric]) => {
      const mentions = metric?.complaint_share?.denominator ?? metric?.praise_share?.denominator ?? 0;
      return {
        key,
        mentions,
        praiseShare: metric?.praise_share?.status === "ok" ? metric.praise_share.value ?? null : null,
        painShare: metric?.complaint_share?.status === "ok" ? metric.complaint_share.value ?? null : null,
      };
    })
    .filter((theme) => theme.key !== "unmatched" && theme.key !== "none" && theme.mentions > 0);

  return {
    id: input.id,
    name: input.name,
    praiseRate: total > 0 ? praise / total : null,
    painRate: total > 0 ? pain / total : null,
    sampled: total,
    themes,
  };
}

export function buildHeadToHead(
  ours: PlaceProfile,
  theirs: PlaceProfile,
  labels: Record<string, string> = {},
): HeadToHead {
  const keys = new Set([...ours.themes.map((theme) => theme.key), ...theirs.themes.map((theme) => theme.key)]);
  const themes = [...keys]
    .filter((key) => key !== "unmatched" && key !== "none")
    .map((key) => compareTheme(ours.themes.find((theme) => theme.key === key), theirs.themes.find((theme) => theme.key === key), key))
    .sort(sortThemes);

  const praiseAdvantagePp = gapPp(ours.praiseRate, theirs.praiseRate, "ours-minus-theirs");
  const painAdvantagePp = gapPp(ours.painRate, theirs.painRate, "theirs-minus-ours");

  const head: HeadToHead = {
    competitorId: theirs.id,
    competitorName: theirs.name,
    ourPraiseRate: ours.praiseRate,
    theirPraiseRate: theirs.praiseRate,
    ourPainRate: ours.painRate,
    theirPainRate: theirs.painRate,
    ourSampled: ours.sampled,
    theirSampled: theirs.sampled,
    praiseAdvantagePp,
    painAdvantagePp,
    themes,
    lines: [],
  };
  head.lines = describeHeadToHead(ours.name, head, labels);
  return head;
}

export function describeHeadToHead(
  ourName: string,
  head: HeadToHead,
  labels: Record<string, string> = {},
): string[] {
  const lines: string[] = [];
  if (head.ourPraiseRate != null && head.theirPraiseRate != null && head.ourPainRate != null && head.theirPainRate != null) {
    lines.push(
      `${ourName} is ${pct(head.ourPraiseRate)} praise and ${pct(head.ourPainRate)} pain across ${head.ourSampled} classified reviews. ${head.competitorName} is ${pct(head.theirPraiseRate)} praise and ${pct(head.theirPainRate)} pain across ${head.theirSampled}.`,
    );
  } else {
    lines.push(
      `Overall praise and pain rates appear after both places have classified reviews in the current plan window.`,
    );
  }

  const ahead = head.themes.filter((theme) => theme.stance === "ahead");
  const behind = head.themes.filter((theme) => theme.stance === "behind");
  const shared = head.themes.filter((theme) => theme.sharedPain);
  const substantive = head.themes.filter((theme) => theme.stance !== "thin");

  if (ahead[0]) lines.push(themeSentence(ourName, head.competitorName, ahead[0], "ahead", labels));
  if (behind[0]) lines.push(themeSentence(ourName, head.competitorName, behind[0], "behind", labels));
  if (shared[0]) {
    lines.push(
      `Both places hear pain about ${labelKey(shared[0].key, labels)}: ${pct(shared[0].ourPain)} of your mentions and ${pct(shared[0].theirPain)} of theirs.`,
    );
  }
  if (substantive.length === 0) {
    lines.push(
      `Theme gaps stay blank until each side has at least ${MIN_MENTIONS} mentions. A gap under ${GAP_PP} percentage points is treated as close.`,
    );
  }
  return lines;
}

function compareTheme(
  ours: ThemeMetric | undefined,
  theirs: ThemeMetric | undefined,
  key: string,
): ThemeComparison {
  const ourMentions = ours?.mentions ?? 0;
  const theirMentions = theirs?.mentions ?? 0;
  const ourPain = ours?.painShare ?? null;
  const theirPain = theirs?.painShare ?? null;
  const ourPraise = ours?.praiseShare ?? null;
  const theirPraise = theirs?.praiseShare ?? null;
  const painAdvantagePp = gapPp(ourPain, theirPain, "theirs-minus-ours");
  const praiseAdvantagePp = gapPp(ourPraise, theirPraise, "ours-minus-theirs");
  const thin = ourMentions < MIN_MENTIONS || theirMentions < MIN_MENTIONS;
  const sharedPain =
    !thin &&
    ourPain != null &&
    theirPain != null &&
    ourPain >= SHARED_PAIN &&
    theirPain >= SHARED_PAIN;

  return {
    key,
    ourMentions,
    theirMentions,
    ourPain,
    theirPain,
    ourPraise,
    theirPraise,
    painAdvantagePp,
    praiseAdvantagePp,
    stance: thin ? "thin" : stanceFromGaps(painAdvantagePp, praiseAdvantagePp),
    sharedPain,
    early: !thin && (ourMentions < CLEAR_MENTIONS || theirMentions < CLEAR_MENTIONS),
  };
}

function stanceFromGaps(painAdvantagePp: number | null, praiseAdvantagePp: number | null): ThemeStance {
  const painAhead = painAdvantagePp != null && painAdvantagePp >= GAP_PP;
  const painBehind = painAdvantagePp != null && painAdvantagePp <= -GAP_PP;
  const praiseAhead = praiseAdvantagePp != null && praiseAdvantagePp >= GAP_PP;
  const praiseBehind = praiseAdvantagePp != null && praiseAdvantagePp <= -GAP_PP;
  if ((painAhead && praiseBehind) || (painBehind && praiseAhead)) return "split";
  if (painAhead || praiseAhead) return "ahead";
  if (painBehind || praiseBehind) return "behind";
  return "close";
}

function gapPp(
  left: number | null,
  right: number | null,
  direction: "ours-minus-theirs" | "theirs-minus-ours",
): number | null {
  if (left == null || right == null) return null;
  const raw = direction === "ours-minus-theirs" ? left - right : right - left;
  return raw * 100;
}

function sortThemes(a: ThemeComparison, b: ThemeComparison): number {
  const rank: Record<ThemeStance, number> = { ahead: 0, behind: 1, split: 2, close: 3, thin: 4 };
  const stance = rank[a.stance] - rank[b.stance];
  if (stance !== 0) return stance;
  return Math.abs(b.painAdvantagePp ?? 0) - Math.abs(a.painAdvantagePp ?? 0);
}

function themeSentence(
  ourName: string,
  theirName: string,
  theme: ThemeComparison,
  stance: "ahead" | "behind",
  labels: Record<string, string>,
): string {
  const name = labelKey(theme.key, labels);
  const early = theme.early ? " Early read — one side still has fewer than 15 mentions." : "";
  const pain =
    theme.ourPain != null && theme.theirPain != null
      ? ` Pain is ${pct(theme.ourPain)} of your ${name} mentions (n=${theme.ourMentions}) and ${pct(theme.theirPain)} of ${theirName}'s (n=${theme.theirMentions}).`
      : "";
  if (stance === "ahead") {
    return `${ourName} looks stronger on ${name}.${pain}${early}`;
  }
  return `${theirName} looks stronger on ${name}.${pain}${early}`;
}

function pct(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function labelKey(key: string, labels: Record<string, string>): string {
  return labels[key] ?? key.replaceAll("_", " ");
}
