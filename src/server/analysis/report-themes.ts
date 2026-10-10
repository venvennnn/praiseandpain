import { aspectLabel, isSpecificIssue } from "@/server/jev/taxonomy";

export type ThemeMetricSlice = {
  value?: number | null;
  denominator?: number | null;
  numerator?: number | null;
  status?: string;
} | null;

export type ThemeMetricBag = Record<
  string,
  {
    praise_share?: ThemeMetricSlice;
    complaint_share?: ThemeMetricSlice;
  }
>;

export type RankedTheme = {
  key: string;
  label: string;
  share: number;
  mentions: number;
  numerator: number | null;
};

export function rankThemes(
  metrics: ThemeMetricBag | null | undefined,
  side: "praise" | "pain",
  limit = 5,
): RankedTheme[] {
  const rows: RankedTheme[] = [];
  for (const [key, metric] of Object.entries(metrics ?? {})) {
    if (key === "unmatched" || key === "none" || key === "uncertain") continue;
    const source = side === "praise" ? metric?.praise_share : metric?.complaint_share;
    const mentions = source?.denominator ?? 0;
    const share = source?.value;
    if (mentions <= 0 || typeof share !== "number" || Number.isNaN(share)) continue;
    rows.push({
      key,
      label: aspectLabel(key),
      share,
      mentions,
      numerator: source?.numerator ?? null,
    });
  }

  const specific = rows.filter((row) => isSpecificIssue(row.key));
  const pool = specific.length >= 3 ? specific : rows;
  const strong = pool.filter((row) => row.mentions >= 3);
  const chosen = strong.length > 0 ? strong : pool;
  return chosen
    .sort((a, b) => b.share - a.share || b.mentions - a.mentions || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function priorityPain(pain: RankedTheme[]): RankedTheme | null {
  return pain[0] ?? null;
}
