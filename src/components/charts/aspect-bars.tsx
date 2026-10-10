"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPercent } from "@/lib/utils";

type Row = {
  aspect: string;
  praise: number | null;
  pain: number | null;
  mentions: number;
};

export function AspectBars({ data }: { data: Row[] }) {
  if (!data.length) {
    return (
      <p className="text-sm text-[var(--color-ink-muted)]">
        No classified aspect data yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="w-full bg-white"
        style={{ height: Math.max(220, data.length * 56) }}
        role="img"
        aria-label="Praise and pain by theme"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
          >
            <CartesianGrid stroke="#EEF0F3" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
              tick={{ fill: "#3D4450", fontSize: 12 }}
              domain={[0, 1]}
            />
            <YAxis
              type="category"
              dataKey="aspect"
              width={148}
              tick={{ fill: "#2a2f38", fontSize: 12 }}
            />
            <Tooltip
              formatter={(value, name) => [
                formatPercent(typeof value === "number" ? value : null, 1),
                String(name),
              ]}
              labelFormatter={(label) => String(label)}
              contentStyle={{ background: "#fff", border: "1px solid #E5E7EB" }}
            />
            <Legend />
            <Bar dataKey="praise" fill="#15803d" name="Praise" radius={[0, 4, 4, 0]} />
            <Bar dataKey="pain" fill="#dc2626" name="Pain" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Accessible alternative for aspect chart</caption>
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[var(--color-ink-muted)]">
            <th className="py-2 font-medium">Aspect</th>
            <th className="py-2 font-medium">Praise</th>
            <th className="py-2 font-medium">Pain</th>
            <th className="py-2 font-medium">Mentions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.aspect} className="border-b border-[var(--color-border)]">
              <td className="py-2">{row.aspect}</td>
              <td className="py-2">{formatPercent(row.praise, 1)}</td>
              <td className="py-2">{formatPercent(row.pain, 1)}</td>
              <td className="py-2">{row.mentions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
