import {
  CALCULATION_VERSION,
  DEFAULT_COMPARISON_THRESHOLDS,
  COMPARISON_FORMULA_VERSION,
  type ComparisonResult,
  type MetricExclusions,
  type MetricResult,
  type Period,
} from "@/shared/schemas/metrics";
import { betaComplaintShare, posteriorDifferenceProbability } from "./beta";

export type AspectCounts = {
  n: number; // eligible classified unique feedback
  m: number; // mentions of aspect
  c: number; // aspect-negative
  p: number; // aspect-positive
  evidenceIds: string[];
  exclusions: MetricExclusions;
};

const emptyExclusions = (): MetricExclusions => ({
  excluded: 0,
  uncertain: 0,
  duplicate: 0,
  undated: 0,
});

function unavailable(
  period: Period,
  exclusions: MetricExclusions = emptyExclusions(),
  evidenceIds: string[] = [],
): MetricResult {
  return {
    value: null,
    numerator: null,
    denominator: null,
    interval: null,
    status: "unavailable",
    exclusions,
    evidenceIds,
    period,
    calculationVersion: CALCULATION_VERSION,
  };
}

export function prevalence(counts: AspectCounts, period: Period): MetricResult {
  if (counts.n <= 0) return unavailable(period, counts.exclusions, counts.evidenceIds);
  return {
    value: counts.m / counts.n,
    numerator: counts.m,
    denominator: counts.n,
    interval: null,
    status: "ok",
    exclusions: counts.exclusions,
    evidenceIds: counts.evidenceIds,
    period,
    calculationVersion: CALCULATION_VERSION,
    label: "prevalence",
  };
}

export function complaintShare(
  counts: AspectCounts,
  period: Period,
): MetricResult {
  if (counts.m <= 0) return unavailable(period, counts.exclusions, counts.evidenceIds);
  const beta = betaComplaintShare(counts.c, counts.m);
  if (!beta) return unavailable(period, counts.exclusions, counts.evidenceIds);
  return {
    value: counts.c / counts.m,
    numerator: counts.c,
    denominator: counts.m,
    interval: {
      lower: beta.lower,
      upper: beta.upper,
      level: 0.95,
      method: "beta_posterior",
    },
    status: "ok",
    exclusions: counts.exclusions,
    evidenceIds: counts.evidenceIds,
    period,
    calculationVersion: CALCULATION_VERSION,
    label: "complaint_share",
  };
}

export function praiseShare(counts: AspectCounts, period: Period): MetricResult {
  if (counts.m <= 0) return unavailable(period, counts.exclusions, counts.evidenceIds);
  return {
    value: counts.p / counts.m,
    numerator: counts.p,
    denominator: counts.m,
    interval: null,
    status: "ok",
    exclusions: counts.exclusions,
    evidenceIds: counts.evidenceIds,
    period,
    calculationVersion: CALCULATION_VERSION,
    label: "praise_share",
  };
}

export function complaintIncidence(
  counts: AspectCounts,
  period: Period,
): MetricResult {
  if (counts.n <= 0) return unavailable(period, counts.exclusions, counts.evidenceIds);
  return {
    value: counts.c / counts.n,
    numerator: counts.c,
    denominator: counts.n,
    interval: null,
    status: "ok",
    exclusions: counts.exclusions,
    evidenceIds: counts.evidenceIds,
    period,
    calculationVersion: CALCULATION_VERSION,
    label: "complaint_incidence",
  };
}

export function compareComplaintShares(params: {
  entityAId: string;
  entityBId: string;
  countsA: AspectCounts;
  countsB: AspectCounts;
  period: Period;
  source: string | null;
  language: string | null;
  aspectId: string | null;
  thresholds?: {
    minAspectMentions: number;
    practicalDifference: number;
    posteriorProbability: number;
  };
  seed?: number;
}): ComparisonResult {
  const thresholds = params.thresholds ?? DEFAULT_COMPARISON_THRESHOLDS;
  const metricA = complaintShare(params.countsA, params.period);
  const metricB = complaintShare(params.countsB, params.period);

  const base = {
    entityAId: params.entityAId,
    entityBId: params.entityBId,
    matchedFilters: {
      source: params.source,
      language: params.language,
      period: params.period,
      aspectId: params.aspectId,
    },
    practicalThreshold: thresholds.practicalDifference,
    formulaVersion: COMPARISON_FORMULA_VERSION,
    thresholdsAreHeuristics: true as const,
    metricA,
    metricB,
  };

  if (
    params.countsA.m < thresholds.minAspectMentions ||
    params.countsB.m < thresholds.minAspectMentions
  ) {
    return {
      ...base,
      difference: null,
      posteriorProbability: null,
      interpretation: "insufficient_data",
    };
  }

  const posterior = posteriorDifferenceProbability({
    complaintsA: params.countsA.c,
    mentionsA: params.countsA.m,
    complaintsB: params.countsB.c,
    mentionsB: params.countsB.m,
    practicalThreshold: thresholds.practicalDifference,
    seed: params.seed ?? 42,
  });

  if (!posterior || metricA.value === null || metricB.value === null) {
    return {
      ...base,
      difference: null,
      posteriorProbability: null,
      interpretation: "inconclusive",
    };
  }

  const difference = metricA.value - metricB.value;
  let interpretation: ComparisonResult["interpretation"] = "inconclusive";
  if (posterior.probabilityABetter >= thresholds.posteriorProbability) {
    interpretation = "advantage";
  } else if (
    1 - posterior.probabilityABetter >=
    thresholds.posteriorProbability
  ) {
    interpretation = "disadvantage";
  }

  return {
    ...base,
    difference,
    posteriorProbability: posterior.probabilityABetter,
    interpretation,
  };
}

/**
 * Priority score: 30% severity, 25% prevalence, 20% momentum,
 * 15% breadth, 10% competitive gap. Renormalise over available components.
 */
export function priorityScore(components: {
  severity?: number | null;
  prevalence?: number | null;
  momentum?: number | null;
  breadth?: number | null;
  competitiveGap?: number | null;
}): {
  score: number | null;
  weightsUsed: Record<string, number>;
  missing: string[];
  formulaVersion: string;
} {
  const weights: Record<string, number> = {
    severity: 0.3,
    prevalence: 0.25,
    momentum: 0.2,
    breadth: 0.15,
    competitiveGap: 0.1,
  };
  const missing: string[] = [];
  let weightSum = 0;
  let weighted = 0;
  const weightsUsed: Record<string, number> = {};

  for (const [key, w] of Object.entries(weights)) {
    const v = components[key as keyof typeof components];
    if (v === null || v === undefined || Number.isNaN(v)) {
      missing.push(key);
      continue;
    }
    weightSum += w;
    weighted += w * Math.min(1, Math.max(0, v));
    weightsUsed[key] = w;
  }

  if (weightSum === 0) {
    return {
      score: null,
      weightsUsed: {},
      missing,
      formulaVersion: "priority.v1",
    };
  }

  for (const key of Object.keys(weightsUsed)) {
    weightsUsed[key] = weightsUsed[key] / weightSum;
  }

  return {
    score: weighted / weightSum,
    weightsUsed,
    missing,
    formulaVersion: "priority.v1",
  };
}
