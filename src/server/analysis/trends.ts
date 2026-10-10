import { isSpecificIssue } from "@/server/jev/taxonomy";
import { betaComplaintShare } from "./beta";

export type TrendAspect = {
  key: string;
  sentiment: string;
  unmatched?: boolean;
};

export type TrendReview = {
  publishedAt: string | null;
  rating: number | null;
  status: string | null;
  isPraise: boolean | null;
  isComplaint: boolean | null;
  irrelevant: boolean;
  aspects: TrendAspect[];
};

export type TrendPoint = {
  period: string;
  label: string;
  collected: number;
  n: number;
  praise: number;
  pain: number;
  mixed: number;
  plain: number;
  praiseRate: number | null;
  painRate: number | null;
  praiseLower: number | null;
  praiseUpper: number | null;
  painLower: number | null;
  painUpper: number | null;
  ratingMean: number | null;
  ratingN: number;
};

export type CategoryTrend = {
  key: string;
  mentions: number;
  positive: number;
  negative: number;
  points: Array<{
    period: string;
    prevalence: number | null;
    negativeShare: number | null;
    positiveShare: number | null;
    mentions: number;
    negative: number;
    positive: number;
  }>;
};

export type RateShift = {
  earlierLabel: string;
  laterLabel: string;
  earlier: number;
  later: number;
  earlierN: number;
  laterN: number;
  percentagePoints: number;
};

export type TrendSeries = {
  grain: "week" | "month";
  timeZone: string;
  undated: number;
  sampled: number;
  points: TrendPoint[];
  categories: CategoryTrend[];
  praiseShift: RateShift | null;
  painShift: RateShift | null;
  categoryMovers: CategoryMover[];
  categoryPraiseMovers: CategoryMover[];
};

export type CategoryMover = {
  key: string;
  earlierLabel: string;
  laterLabel: string;
  earlier: number;
  later: number;
  earlierMentions: number;
  laterMentions: number;
  percentagePoints: number;
};

const MIN_SHIFT_N = 8;
const MIN_THEME_MENTIONS = 3;

export function buildTrends(
  reviews: TrendReview[],
  options?: { timeZone?: string; maxCategories?: number; grain?: "week" | "month" },
): TrendSeries {
  const timeZone = timeZoneOrUtc(options?.timeZone ?? "UTC");
  const maxCategories = options?.maxCategories ?? 5;
  let undated = 0;
  const dated: Array<TrendReview & { civil: string }> = [];

  for (const review of reviews) {
    if (!review.publishedAt || Number.isNaN(Date.parse(review.publishedAt))) {
      undated += 1;
      continue;
    }
    dated.push({ ...review, civil: civilDate(review.publishedAt, timeZone) });
  }

  dated.sort((a, b) => a.civil.localeCompare(b.civil));
  const grain = options?.grain ?? chooseGrain(dated.map((row) => row.civil));
  const keys = dated.length
    ? periodsBetween(dated[0].civil, dated[dated.length - 1].civil, grain)
    : [];

  const buckets = new Map<
    string,
    {
      collected: number;
      n: number;
      praise: number;
      pain: number;
      mixed: number;
      plain: number;
      ratingSum: number;
      ratingN: number;
      themes: Map<string, { mentions: number; positive: number; negative: number }>;
    }
  >();

  for (const key of keys) {
    buckets.set(key, emptyBucket());
  }

  for (const review of dated) {
    const key = grain === "month" ? review.civil.slice(0, 7) : isoWeekKey(review.civil);
    const bucket = buckets.get(key) ?? emptyBucket();
    buckets.set(key, bucket);
    bucket.collected += 1;
    if (typeof review.rating === "number" && review.rating >= 1 && review.rating <= 5) {
      bucket.ratingSum += review.rating;
      bucket.ratingN += 1;
    }
    if (!eligible(review)) continue;
    bucket.n += 1;
    const praiseOnly = Boolean(review.isPraise) && !review.isComplaint;
    const painOnly = Boolean(review.isComplaint) && !review.isPraise;
    if (praiseOnly) bucket.praise += 1;
    else if (painOnly) bucket.pain += 1;
    else if (review.isPraise && review.isComplaint) bucket.mixed += 1;
    else bucket.plain += 1;

    const seen = new Set<string>();
    for (const aspect of review.aspects) {
      if (!aspect.key || aspect.unmatched || aspect.key === "unmatched" || aspect.key === "none") continue;
      if (seen.has(aspect.key)) continue;
      seen.add(aspect.key);
      const theme = bucket.themes.get(aspect.key) ?? { mentions: 0, positive: 0, negative: 0 };
      theme.mentions += 1;
      if (aspect.sentiment === "positive" || aspect.sentiment === "mixed") theme.positive += 1;
      if (aspect.sentiment === "negative" || aspect.sentiment === "mixed") theme.negative += 1;
      bucket.themes.set(aspect.key, theme);
    }
  }

  const points: TrendPoint[] = [...buckets.entries()].map(([period, bucket]) => {
    const praiseInterval = bucket.n > 0 ? betaComplaintShare(bucket.praise, bucket.n) : null;
    const painInterval = bucket.n > 0 ? betaComplaintShare(bucket.pain, bucket.n) : null;
    return {
      period,
      label: periodLabel(period, grain),
      collected: bucket.collected,
      n: bucket.n,
      praise: bucket.praise,
      pain: bucket.pain,
      mixed: bucket.mixed,
      plain: bucket.plain,
      praiseRate: bucket.n > 0 ? bucket.praise / bucket.n : null,
      painRate: bucket.n > 0 ? bucket.pain / bucket.n : null,
      praiseLower: praiseInterval?.lower ?? null,
      praiseUpper: praiseInterval?.upper ?? null,
      painLower: painInterval?.lower ?? null,
      painUpper: painInterval?.upper ?? null,
      ratingMean: bucket.ratingN > 0 ? bucket.ratingSum / bucket.ratingN : null,
      ratingN: bucket.ratingN,
    };
  });

  const themeTotals = new Map<string, { mentions: number; positive: number; negative: number }>();
  for (const bucket of buckets.values()) {
    for (const [key, theme] of bucket.themes) {
      const total = themeTotals.get(key) ?? { mentions: 0, positive: 0, negative: 0 };
      total.mentions += theme.mentions;
      total.positive += theme.positive;
      total.negative += theme.negative;
      themeTotals.set(key, total);
    }
  }

  const rankedThemes = rankThemeTotals(themeTotals, maxCategories);
  const categories: CategoryTrend[] = rankedThemes
    .map(([key, total]) => ({
      key,
      mentions: total.mentions,
      positive: total.positive,
      negative: total.negative,
      points: points.map((point) => {
        const theme = buckets.get(point.period)?.themes.get(key);
        const mentions = theme?.mentions ?? 0;
        const positive = theme?.positive ?? 0;
        const negative = theme?.negative ?? 0;
        return {
          period: point.period,
          prevalence: point.n > 0 ? mentions / point.n : null,
          negativeShare: mentions > 0 ? negative / mentions : null,
          positiveShare: mentions > 0 ? positive / mentions : null,
          mentions,
          negative,
          positive,
        };
      }),
    }));

  return {
    grain,
    timeZone,
    undated,
    sampled: reviews.length,
    points,
    categories,
    praiseShift: rateShift(points, "praiseRate"),
    painShift: rateShift(points, "painRate"),
    categoryMovers: categoryMovers(categories, points, "negativeShare"),
    categoryPraiseMovers: categoryMovers(categories, points, "positiveShare"),
  };
}

function rankThemeTotals(
  themeTotals: Map<string, { mentions: number; positive: number; negative: number }>,
  maxCategories: number,
) {
  const entries = [...themeTotals.entries()];
  const specific = entries.filter(([key]) => isSpecificIssue(key));
  const pool = specific.length >= 3 ? specific : entries;
  return pool.sort((a, b) => b[1].mentions - a[1].mentions || a[0].localeCompare(b[0])).slice(0, maxCategories);
}

function eligible(review: TrendReview): boolean {
  if (!review.status || review.status === "failed" || review.status === "skipped") return false;
  if (review.irrelevant) return false;
  return true;
}

function emptyBucket() {
  return {
    collected: 0,
    n: 0,
    praise: 0,
    pain: 0,
    mixed: 0,
    plain: 0,
    ratingSum: 0,
    ratingN: 0,
    themes: new Map<string, { mentions: number; positive: number; negative: number }>(),
  };
}

function rateShift(points: TrendPoint[], field: "praiseRate" | "painRate"): RateShift | null {
  const usable = points.filter((point) => point.n >= MIN_SHIFT_N && point[field] != null);
  if (usable.length < 2) return null;
  const earlier = usable[0];
  const later = usable[usable.length - 1];
  const earlierRate = earlier[field] as number;
  const laterRate = later[field] as number;
  return {
    earlierLabel: earlier.label,
    laterLabel: later.label,
    earlier: earlierRate,
    later: laterRate,
    earlierN: earlier.n,
    laterN: later.n,
    percentagePoints: (laterRate - earlierRate) * 100,
  };
}

function categoryMovers(
  categories: CategoryTrend[],
  points: TrendPoint[],
  field: "negativeShare" | "positiveShare",
): CategoryMover[] {
  const labels = new Map(points.map((point) => [point.period, point.label]));
  const movers = [];
  for (const category of categories) {
    const usable = category.points.filter(
      (point) => point.mentions >= MIN_THEME_MENTIONS && point[field] != null,
    );
    if (usable.length < 2) continue;
    const earlier = usable[0];
    const later = usable[usable.length - 1];
    const earlierRate = earlier[field] as number;
    const laterRate = later[field] as number;
    movers.push({
      key: category.key,
      earlierLabel: labels.get(earlier.period) ?? earlier.period,
      laterLabel: labels.get(later.period) ?? later.period,
      earlier: earlierRate,
      later: laterRate,
      earlierMentions: earlier.mentions,
      laterMentions: later.mentions,
      percentagePoints: (laterRate - earlierRate) * 100,
    });
  }
  return movers.sort((a, b) => Math.abs(b.percentagePoints) - Math.abs(a.percentagePoints));
}

export function chooseGrain(civilDates: string[]): "week" | "month" {
  if (civilDates.length < 2) return "month";
  const span = daysBetween(civilDates[0], civilDates[civilDates.length - 1]);
  return span <= 270 ? "week" : "month";
}

function periodsBetween(start: string, end: string, grain: "week" | "month"): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  let cursor = start;
  while (cursor <= end) {
    const key = grain === "month" ? cursor.slice(0, 7) : isoWeekKey(cursor);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
    cursor = addCivilDays(cursor, 1);
  }
  return keys;
}

function daysBetween(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function addCivilDays(civil: string, days: number): string {
  const [year, month, day] = civil.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoWeekKey(civil: string): string {
  const [year, month, day] = civil.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

function periodLabel(period: string, grain: "week" | "month"): string {
  if (grain === "week") {
    const [year, week] = period.split("-W");
    return `W${week} ${year}`;
  }
  const [year, month] = period.split("-").map(Number);
  const name = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  return `${name} ${year}`;
}

function civilDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function timeZoneOrUtc(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}
