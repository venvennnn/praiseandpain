import Link from "next/link";
import { formatPercent } from "@/lib/utils";
import type { RankedTheme } from "@/server/analysis/report-themes";

export function ThemeRank({
  title,
  tone,
  rows,
  seeAllHref,
  empty,
}: {
  title: string;
  tone: "praise" | "pain";
  rows: RankedTheme[];
  seeAllHref: string;
  empty: string;
}) {
  const ink = tone === "praise" ? "text-[var(--color-praise)]" : "text-[var(--color-pain)]";
  const bar = tone === "praise" ? "bg-[var(--color-praise)]" : "bg-[var(--color-pain)]";
  return (
    <section className={`rounded-2xl p-4 ${tone === "praise" ? "tone-praise" : "tone-pain"}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={`text-sm font-semibold ${ink}`}>{title}</h2>
        <Link href={seeAllHref} className={`text-xs font-semibold ${ink}`}>
          See all
        </Link>
      </div>
      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
        {tone === "praise" ? "Share of positive mentions" : "Share of negative mentions"}
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-ink-muted)]">{empty}</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {rows.map((row, index) => (
            <li key={row.key}>
              <div className="grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-2 text-sm">
                <span className={`font-semibold ${ink}`}>{index + 1}</span>
                <span className="font-medium text-[var(--color-ink)]">{row.label}</span>
                <span className="text-[var(--color-ink-muted)]">{formatPercent(row.share, 0)}</span>
              </div>
              <div className="share-bar mt-1.5 ml-7 bg-white/80">
                <span className={bar} style={{ width: `${Math.max(4, Math.min(100, row.share * 100))}%` }} />
              </div>
              <p className="mt-1 ml-7 text-xs text-[var(--color-ink-muted)]">
                {row.numerator ?? "—"} of {row.mentions} mentions
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
