import type { MetricResult } from "@/shared/schemas/metrics";
import { formatPercent } from "@/lib/utils";

export function MetricCard({
  title,
  metric,
  discloseMixed,
}: {
  title: string;
  metric: MetricResult | null | undefined;
  discloseMixed?: boolean;
}) {
  if (!metric) {
    return (
      <div className="border-b border-[var(--color-border)] py-4">
        <p className="text-sm text-[var(--color-ink-muted)]">{title}</p>
        <p className="mt-1 text-2xl text-[var(--color-ink-muted)]">Unavailable</p>
      </div>
    );
  }

  const emptyCollection =
    metric.status === "unavailable" &&
    metric.exclusions.excluded === 0 &&
    metric.denominator === null;

  return (
    <div className="border-b border-[var(--color-border)] py-4">
      <p className="text-sm text-[var(--color-ink-muted)]">{title}</p>
      {metric.status === "unavailable" ? (
        <p className="mt-1 text-2xl text-[var(--color-ink)]">
          {emptyCollection ? "No feedback collected" : "Unavailable"}
        </p>
      ) : (
        <>
          <p className="mt-1 text-3xl font-[family-name:var(--font-display)] text-[var(--color-ink)]">
            {formatPercent(metric.value, 1)}
          </p>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            {metric.numerator}/{metric.denominator}
            {metric.interval
              ? ` · 95% CI ${formatPercent(metric.interval.lower, 0)}–${formatPercent(metric.interval.upper, 0)}`
              : ""}
          </p>
        </>
      )}
      {discloseMixed ? (
        <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
          Mixed feedback can count toward both praise and complaint shares; they need not total 100%.
        </p>
      ) : null}
    </div>
  );
}
