export const PLAN_LIMITS = {
  base: 200,
  pro: 2000,
} as const;

export type WorkspacePlan = keyof typeof PLAN_LIMITS;

export function feedbackLimitForPlan(plan: string | null | undefined): number {
  return plan === "pro" ? PLAN_LIMITS.pro : PLAN_LIMITS.base;
}

export function planLabel(plan: string | null | undefined): string {
  return plan === "pro" ? "Pro · 2,000 newest reviews per place" : "Base · 200 newest reviews per place";
}

/** Pages needed to walk the newest `limit` reviews. Maps' first page is ~8; later pages are smaller on some sources, so this estimate is conservative. */
export function pagesToCoverNewest(limit: number): number {
  if (limit <= 8) return 1;
  return 1 + Math.ceil((limit - 8) / 8);
}
