import { z } from "zod";

export const CALCULATION_VERSION = "metrics.v1" as const;
export const COMPARISON_FORMULA_VERSION = "comparison.v1" as const;
export const PRIORITY_FORMULA_VERSION = "priority.v1" as const;

export const MetricStatusSchema = z.enum([
  "ok",
  "unavailable",
  "insufficient_data",
  "partial",
  "stale",
]);

export const CredibleIntervalSchema = z.object({
  lower: z.number(),
  upper: z.number(),
  level: z.literal(0.95),
  method: z.literal("beta_posterior"),
});

export const MetricExclusionsSchema = z.object({
  excluded: z.number().int().nonnegative(),
  uncertain: z.number().int().nonnegative(),
  duplicate: z.number().int().nonnegative(),
  undated: z.number().int().nonnegative(),
});

export const PeriodSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  timezone: z.string(),
});

export const MetricResultSchema = z.object({
  value: z.number().nullable(),
  numerator: z.number().int().nonnegative().nullable(),
  denominator: z.number().int().nonnegative().nullable(),
  interval: CredibleIntervalSchema.nullable(),
  status: MetricStatusSchema,
  exclusions: MetricExclusionsSchema,
  evidenceIds: z.array(z.string().uuid()),
  period: PeriodSchema,
  calculationVersion: z.literal(CALCULATION_VERSION),
  label: z.string().optional(),
});

export type MetricResult = z.infer<typeof MetricResultSchema>;
export type MetricExclusions = z.infer<typeof MetricExclusionsSchema>;
export type Period = z.infer<typeof PeriodSchema>;

export const ComparisonInterpretationSchema = z.enum([
  "advantage",
  "disadvantage",
  "inconclusive",
  "insufficient_data",
]);

export const ComparisonResultSchema = z.object({
  entityAId: z.string().uuid(),
  entityBId: z.string().uuid(),
  matchedFilters: z.object({
    source: z.string().nullable(),
    language: z.string().nullable(),
    period: PeriodSchema,
    aspectId: z.string().uuid().nullable(),
  }),
  difference: z.number().nullable(),
  posteriorProbability: z.number().nullable(),
  practicalThreshold: z.number(),
  interpretation: ComparisonInterpretationSchema,
  metricA: MetricResultSchema,
  metricB: MetricResultSchema,
  formulaVersion: z.literal(COMPARISON_FORMULA_VERSION),
  thresholdsAreHeuristics: z.literal(true),
});

export type ComparisonResult = z.infer<typeof ComparisonResultSchema>;

export const DEFAULT_COMPARISON_THRESHOLDS = {
  minAspectMentions: 30,
  practicalDifference: 0.05,
  posteriorProbability: 0.95,
} as const;
