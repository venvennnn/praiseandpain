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
      <div className="h-72 w-full bg-white" role="img" aria-label="Praise and pain by aspect">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#EEF0F3" vertical={false} />
            <XAxis dataKey="aspect" tick={{ fill: "#3D4450", fontSize: 12 }} />
            <YAxis
              tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
              tick={{ fill: "#3D4450", fontSize: 12 }}
              domain={[0, 1]}
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
            <Bar dataKey="praise" fill="var(--color-praise)" name="Praise share" />
            <Bar dataKey="pain" fill="var(--color-pain)" name="Complaint share" />
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
