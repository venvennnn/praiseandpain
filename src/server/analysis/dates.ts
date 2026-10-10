import { parseISO, isValid, subDays, subMonths } from "date-fns";
import type { FeedbackDatePrecisionSchema } from "@/shared/schemas/domain";
import { z } from "zod";

type Precision = z.infer<typeof FeedbackDatePrecisionSchema>;

export type ParsedFeedbackDate = {
  publishedAt: string | null;
  precision: Precision;
  original: string | null;
  crossesBoundaryRisk: boolean;
};

const RELATIVE_PATTERNS: Array<{
  re: RegExp;
  apply: (n: number, now: Date) => Date;
  precision: Precision;
}> = [
  {
    re: /^(\d+)\s+days?\s+ago$/i,
    apply: (n, now) => subDays(now, n),
    precision: "day",
  },
  {
    re: /^a\s+day\s+ago$/i,
    apply: (_n, now) => subDays(now, 1),
    precision: "day",
  },
  {
    re: /^(\d+)\s+weeks?\s+ago$/i,
    apply: (n, now) => subDays(now, n * 7),
    precision: "relative",
  },
  {
    re: /^(\d+)\s+months?\s+ago$/i,
    apply: (n, now) => subMonths(now, n),
    precision: "month",
  },
  {
    re: /^a\s+month\s+ago$/i,
    apply: (_n, now) => subMonths(now, 1),
    precision: "month",
  },
  {
    re: /^(\d+)\s+years?\s+ago$/i,
    apply: (n, now) => subMonths(now, n * 12),
    precision: "relative",
  },
];

export function parseFeedbackDate(
  raw: string | null | undefined,
  now: Date = new Date(),
  comparisonStart?: Date,
  comparisonEnd?: Date,
): ParsedFeedbackDate {
  if (!raw || !raw.trim()) {
    return {
      publishedAt: null,
      precision: "unknown",
      original: raw ?? null,
      crossesBoundaryRisk: false,
    };
  }

  const trimmed = raw.trim();
  const iso = parseISO(trimmed);
  if (isValid(iso) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return {
      publishedAt: iso.toISOString(),
      precision: trimmed.includes("T") ? "exact" : "day",
      original: trimmed,
      crossesBoundaryRisk: false,
    };
  }

  const native = new Date(trimmed);
  if (!Number.isNaN(native.getTime()) && /\d{4}/.test(trimmed)) {
    return {
      publishedAt: native.toISOString(),
      precision: "day",
      original: trimmed,
      crossesBoundaryRisk: false,
    };
  }

  for (const pattern of RELATIVE_PATTERNS) {
    const match = trimmed.match(pattern.re);
    if (match) {
      const n = match[1] ? Number(match[1]) : 1;
      const estimated = pattern.apply(n, now);
      let crossesBoundaryRisk = false;
      if (comparisonStart && comparisonEnd) {
        // Relative dates have uncertainty that may span the boundary.
        const uncertaintyDays =
          pattern.precision === "month" ? 15 : pattern.precision === "relative" ? 7 : 1;
        const low = subDays(estimated, uncertaintyDays);
        const high = new Date(estimated.getTime() + uncertaintyDays * 86400000);
        crossesBoundaryRisk =
          (low < comparisonStart && high >= comparisonStart) ||
          (low <= comparisonEnd && high > comparisonEnd);
      }
      return {
        publishedAt: estimated.toISOString(),
        precision: pattern.precision,
        original: trimmed,
        crossesBoundaryRisk,
      };
    }
  }

  return {
    publishedAt: null,
    precision: "unknown",
    original: trimmed,
    crossesBoundaryRisk: false,
  };
}

/** Undated feedback must stay out of period comparisons. */
export function isEligibleForPeriodComparison(
  parsed: ParsedFeedbackDate,
): boolean {
  return (
    parsed.publishedAt !== null &&
    parsed.precision !== "unknown" &&
    !parsed.crossesBoundaryRisk
  );
}
