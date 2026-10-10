"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { aspectLabel } from "@/server/jev/taxonomy";
import { formatPercent } from "@/lib/utils";
import type { TrendSeries } from "@/server/analysis/trends";

const CATEGORY_COLORS = ["#4338ca", "#0369a1", "#a16207", "#7c3aed", "#334155"];

export function TrendCharts({
  places,
}: {
  places: Array<{ id: string; name: string; role: string; series: TrendSeries }>;
}) {
  const [placeId, setPlaceId] = useState(places.find((place) => place.role === "primary")?.id ?? places[0]?.id);
  const place = places.find((item) => item.id === placeId) ?? places[0];
  const series = place?.series;
  const categoryRows = useMemo(() => {
    if (!series) return [];
    return series.points.map((point) => {
      const row: Record<string, string | number | null> = { label: point.label };
      for (const category of series.categories) {
        const hit = category.points.find((item) => item.period === point.period);
        row[`${category.key}:prevalence`] = hit?.prevalence ?? null;
        row[`${category.key}:negative`] = hit && hit.mentions >= 3 ? hit.negativeShare : null;
      }
      return row;
    });
  }, [series]);

  if (!place || !series) {
    return <p className="text-sm text-[var(--color-ink-muted)]">No places to chart yet.</p>;
  }

  const hasRates = series.points.some((point) => point.n > 0);
  const hasRatings = series.points.some((point) => point.ratingN > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl">Trends</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-ink-muted)]">
            {series.grain === "week" ? "Weekly" : "Monthly"} buckets in {series.timeZone}. Positive % is
            praise with no complaint. Negative % is a complaint with no praise. Mixed reviews stay out of
            both, so the two lines do not have to sum to 100%. Bands in the table are 95% Beta(1,1)
            credible intervals. Empty periods stay blank.
          </p>
        </div>
        {places.length > 1 ? (
          <label className="text-sm">
            <span className="mr-2 text-[var(--color-ink-muted)]">Place</span>
            <select
              className="h-10 rounded-md border border-[var(--color-border)] bg-white px-3"
              value={place.id}
              onChange={(event) => setPlaceId(event.target.value)}
            >
              {places.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} {item.role === "primary" ? "(you)" : "(competitor)"}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <ShiftRow series={series} />

      {hasRates ? (
        <ChartCard title="Positive % and negative %">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#EEF0F3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#3D4450", fontSize: 12 }} />
              <YAxis
                yAxisId="rate"
                domain={[0, 1]}
                tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
                tick={{ fill: "#3D4450", fontSize: 12 }}
              />
              <YAxis
                yAxisId="volume"
                orientation="right"
                allowDecimals={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
              />
              <Tooltip content={<RateTooltip />} />
              <Legend />
              <Bar yAxisId="volume" dataKey="collected" name="Reviews" fill="#d4d4d8" radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="praiseRate"
                name="Positive %"
                stroke="#15803d"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="painRate"
                name="Negative %"
                stroke="#dc2626"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : (
        <p className="text-sm text-[var(--color-ink-muted)]">
          No dated, classified reviews in this window yet. Trends stay empty until classification finishes.
        </p>
      )}

      {series.categories.length > 0 ? (
        <ChartCard title="Category share of classified reviews">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={categoryRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#EEF0F3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#3D4450", fontSize: 12 }} />
              <YAxis
                domain={[0, 1]}
                tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
                tick={{ fill: "#3D4450", fontSize: 12 }}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatPercent(typeof value === "number" ? value : null, 0),
                  aspectLabel(String(name).replace(":prevalence", "")),
                ]}
              />
              <Legend formatter={(value) => aspectLabel(String(value).replace(":prevalence", ""))} />
              {series.categories.map((category, index) => (
                <Line
                  key={category.key}
                  type="monotone"
                  dataKey={`${category.key}:prevalence`}
                  name={category.key}
                  stroke={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}

      {series.categories.length > 0 ? (
        <ChartCard title="Negative share inside each category">
          <p className="mb-3 text-xs text-[var(--color-ink-muted)]">
            Among reviews that mention the theme. Periods with fewer than 3 mentions are left blank.
            A mixed mention counts as both positive and negative, so those shares need not sum to 100%.
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={categoryRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#EEF0F3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#3D4450", fontSize: 12 }} />
              <YAxis
                domain={[0, 1]}
                tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
                tick={{ fill: "#3D4450", fontSize: 12 }}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatPercent(typeof value === "number" ? value : null, 0),
                  aspectLabel(String(name).replace(":negative", "")),
                ]}
              />
              <Legend formatter={(value) => aspectLabel(String(value).replace(":negative", ""))} />
              {series.categories.map((category, index) => (
                <Line
                  key={category.key}
                  type="monotone"
                  dataKey={`${category.key}:negative`}
                  name={category.key}
                  stroke={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}

      {hasRatings ? (
        <ChartCard title="Mean star rating" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#EEF0F3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#3D4450", fontSize: 12 }} />
              <YAxis domain={[1, 5]} tick={{ fill: "#3D4450", fontSize: 12 }} />
              <Tooltip
                formatter={(value, _name, item) => {
                  const payload = item?.payload as { ratingN?: number; ratingMean?: number } | undefined;
                  const mean = typeof value === "number" ? value.toFixed(2) : "—";
                  return [`${mean} (${payload?.ratingN ?? 0} rated)`, "Mean rating"];
                }}
              />
              <Line
                type="monotone"
                dataKey="ratingMean"
                name="Mean rating"
                stroke="#4338ca"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}

      {hasRates ? <PeriodTable series={series} /> : null}
      {series.undated > 0 ? (
        <p className="text-xs text-[var(--color-ink-muted)]">
          {series.undated} review{series.undated === 1 ? "" : "s"} had no usable date and {series.undated === 1 ? "is" : "are"} left out of these series.
        </p>
      ) : null}
    </div>
  );
}

function ShiftRow({ series }: { series: TrendSeries }) {
  if (!series.praiseShift && !series.painShift && series.categoryMovers.length === 0) {
    return (
      <p className="text-sm text-[var(--color-ink-muted)]">
        A change summary appears once two periods each have at least 8 classified reviews.
      </p>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <ShiftCard
        label="Positive %"
        shift={series.praiseShift}
        tone="praise"
      />
      <ShiftCard label="Negative %" shift={series.painShift} tone="pain" />
      <div className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-3">
        <p className="text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">
          Category pain
        </p>
        {series.categoryMovers.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            Needs two periods with at least 3 mentions of the same theme.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {series.categoryMovers.slice(0, 3).map((mover) => (
              <li key={mover.key}>
                <span className="font-medium">{aspectLabel(mover.key)}</span>{" "}
                <span className={mover.percentagePoints > 0 ? "text-[var(--color-pain)]" : "text-[var(--color-praise)]"}>
                  {mover.percentagePoints > 0 ? "+" : ""}
                  {mover.percentagePoints.toFixed(0)} pp
                </span>
                <span className="text-[var(--color-ink-muted)]">
                  {" "}
                  ({mover.earlierLabel} → {mover.laterLabel})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ShiftCard({
  label,
  shift,
  tone,
}: {
  label: string;
  shift: TrendSeries["praiseShift"];
  tone: "praise" | "pain";
}) {
  const ink = tone === "praise" ? "text-[var(--color-praise)]" : "text-[var(--color-pain)]";
  return (
    <div className={`rounded-lg px-3 py-3 ${tone === "praise" ? "tone-praise" : "tone-pain"}`}>
      <p className={`text-xs font-semibold tracking-wide uppercase ${ink}`}>{label}</p>
      {shift ? (
        <>
          <p className={`mt-1 font-[family-name:var(--font-display)] text-2xl ${ink}`}>
            {shift.percentagePoints > 0 ? "+" : ""}
            {shift.percentagePoints.toFixed(1)} pp
          </p>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            {formatPercent(shift.earlier, 0)} (n={shift.earlierN}) → {formatPercent(shift.later, 0)} (n=
            {shift.laterN})
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">Not enough volume yet.</p>
      )}
    </div>
  );
}

function PeriodTable({ series }: { series: TrendSeries }) {
  const rows = [...series.points].reverse().filter((point) => point.collected > 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Period rates with denominators and credible intervals</caption>
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[var(--color-ink-muted)]">
            <th className="py-2 font-medium">Period</th>
            <th className="py-2 font-medium">Reviews</th>
            <th className="py-2 font-medium">Classified</th>
            <th className="py-2 font-medium">Positive</th>
            <th className="py-2 font-medium">Negative</th>
            <th className="py-2 font-medium">Mixed</th>
            <th className="py-2 font-medium">Mean rating</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((point) => (
            <tr key={point.period} className="border-b border-[var(--color-border)]">
              <td className="py-2">{point.label}</td>
              <td className="py-2">{point.collected}</td>
              <td className="py-2">{point.n}</td>
              <td className="py-2 text-[var(--color-praise)]">
                {formatPercent(point.praiseRate, 0)}
                <Interval lower={point.praiseLower} upper={point.praiseUpper} />
              </td>
              <td className="py-2 text-[var(--color-pain)]">
                {formatPercent(point.painRate, 0)}
                <Interval lower={point.painLower} upper={point.painUpper} />
              </td>
              <td className="py-2">{point.n ? point.mixed : "—"}</td>
              <td className="py-2">
                {point.ratingMean == null ? "—" : `${point.ratingMean.toFixed(2)} (${point.ratingN})`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Interval({ lower, upper }: { lower: number | null; upper: number | null }) {
  if (lower == null || upper == null) return null;
  return (
    <span className="mt-0.5 block text-xs text-[var(--color-ink-muted)]">
      {formatPercent(lower, 0)}–{formatPercent(upper, 0)}
    </span>
  );
}

function ChartCard({
  title,
  children,
  height = 300,
}: {
  title: string;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h3>
      <div className="mt-3 bg-white" style={{ height }}>
        {children}
      </div>
    </section>
  );
}

function RateTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: Record<string, unknown> }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-xs">
      <p className="font-semibold">{label}</p>
      <p>{String(point.collected ?? 0)} reviews · {String(point.n ?? 0)} classified</p>
      <p className="text-[var(--color-praise)]">
        Positive {formatPercent(point.praiseRate as number | null, 0)} ({String(point.praise ?? 0)})
      </p>
      <p className="text-[var(--color-pain)]">
        Negative {formatPercent(point.painRate as number | null, 0)} ({String(point.pain ?? 0)})
      </p>
      <p>Mixed {String(point.mixed ?? 0)} · Uncategorised {String(point.plain ?? 0)}</p>
    </div>
  );
}
