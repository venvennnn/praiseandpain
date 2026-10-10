"use client";

import { useState } from "react";
import { GeminiBrief } from "@/components/workspace/gemini-brief";
import { aspectLabel } from "@/server/jev/taxonomy";
import { formatPercent } from "@/lib/utils";
import type { HeadToHead, ThemeComparison } from "@/server/analysis/head-to-head";

export function CompetitorBoard({
  workspaceId,
  ourName,
  heads,
  geminiReady,
}: {
  workspaceId: string;
  ourName: string;
  heads: HeadToHead[];
  geminiReady: boolean;
}) {
  const [selectedId, setSelectedId] = useState(heads[0]?.competitorId ?? "");
  const head = heads.find((item) => item.competitorId === selectedId) ?? heads[0];

  if (!head) {
    return (
      <p className="mt-6 text-sm text-[var(--color-ink-muted)]">
        Add a competitor to see where {ourName} leads and where it trails.
      </p>
    );
  }

  const painHeadline = headlineFor(ourName, head);
  const ahead = head.themes.filter((theme) => theme.stance === "ahead");
  const behind = head.themes.filter((theme) => theme.stance === "behind");
  const shared = head.themes.filter((theme) => theme.sharedPain);
  const ranked = head.themes
    .filter((theme) => theme.stance !== "thin")
    .sort((a, b) => Math.abs(b.painAdvantagePp ?? 0) - Math.abs(a.painAdvantagePp ?? 0));
  const maxGap = Math.max(8, ...ranked.map((theme) => Math.abs(theme.painAdvantagePp ?? 0)));

  return (
    <div className="mt-8 space-y-4">
      {heads.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {heads.map((item) => (
            <button
              key={item.competitorId}
              type="button"
              onClick={() => setSelectedId(item.competitorId)}
              className={`rounded-full border px-3 py-1 text-sm ${
                item.competitorId === head.competitorId
                  ? "border-[var(--color-action)] bg-[var(--color-highlight)] font-semibold text-[var(--color-action)]"
                  : "border-[var(--color-border)] bg-white"
              }`}
            >
              vs {item.competitorName}
            </button>
          ))}
        </div>
      ) : null}

      <section className="rounded-2xl bg-[var(--color-highlight)] p-5">
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-action)] uppercase">
          {ourName} vs {head.competitorName}
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl leading-tight">{painHeadline}</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <ScoreCard
            label="Positive share"
            ours={head.ourPraiseRate}
            theirs={head.theirPraiseRate}
            ourN={head.ourSampled}
            theirN={head.theirSampled}
            advantagePp={head.praiseAdvantagePp}
            ourName={ourName}
            theirName={head.competitorName}
          />
          <ScoreCard
            label="Pain share"
            ours={head.ourPainRate}
            theirs={head.theirPainRate}
            ourN={head.ourSampled}
            theirN={head.theirSampled}
            advantagePp={head.painAdvantagePp}
            ourName={ourName}
            theirName={head.competitorName}
          />
        </div>
      </section>

      <GeminiBrief
        key={head.competitorId}
        title="Gemini comparison"
        ready={geminiReady}
        fallbackHeadline={painHeadline}
        fallback={head.lines}
        endpoint={`/api/workspaces/${workspaceId}/compare-brief`}
        body={{ competitorId: head.competitorId }}
      />

      <section className="grid gap-3 lg:grid-cols-3">
        <Callout title="You lead" tone="praise" themes={ahead} empty="No theme is at least 8 percentage points in your favour." />
        <Callout title="They lead" tone="pain" themes={behind} empty="No theme is at least 8 percentage points in their favour." />
        <Callout title="Shared pain" tone="plain" themes={shared} empty="No theme where both sides are at least 35% pain." />
      </section>

      <section className="report-card p-5">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">Where the gap is widest</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Pain share of mentions. Green means you have less pain. A theme needs 5 mentions on each side. Under 8 points stays close. Under 15 mentions is an early read.
        </p>
        {ranked.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
            Sync both places and let classification finish. Gaps appear from those scores.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {ranked.slice(0, 8).map((theme) => (
              <GapRow key={theme.key} theme={theme} maxGap={maxGap} ourName={ourName} theirName={head.competitorName} />
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <RankColumn title="Your pain themes" name={ourName} themes={byPain(head.themes, "ours")} side="ours" />
        <RankColumn title="Their pain themes" name={head.competitorName} themes={byPain(head.themes, "theirs")} side="theirs" />
      </section>
    </div>
  );
}

function headlineFor(ourName: string, head: HeadToHead): string {
  const gap = head.painAdvantagePp;
  if (gap == null || head.ourSampled === 0 || head.theirSampled === 0) {
    return "Both places need classified reviews before a gap can be named.";
  }
  if (gap >= 8) return `${ourName} has ${gap.toFixed(0)} pp less pain than ${head.competitorName}.`;
  if (gap <= -8) return `${head.competitorName} has ${Math.abs(gap).toFixed(0)} pp less pain.`;
  return `Pain is close — ${Math.abs(gap).toFixed(0)} pp apart.`;
}

function ScoreCard({
  label,
  ours,
  theirs,
  ourN,
  theirN,
  advantagePp,
  ourName,
  theirName,
}: {
  label: string;
  ours: number | null;
  theirs: number | null;
  ourN: number;
  theirN: number;
  advantagePp: number | null;
  ourName: string;
  theirName: string;
}) {
  const favorable = advantagePp != null && advantagePp > 0;
  const tone = advantagePp == null || advantagePp === 0 ? "plain" : favorable ? "praise" : "pain";
  return (
    <div className={`rounded-2xl px-4 py-4 ${tone === "praise" ? "tone-praise" : tone === "pain" ? "tone-pain" : "bg-white"}`}>
      <p className="text-xs font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <Rate name={ourName} value={ours} n={ourN} />
        <Rate name={theirName} value={theirs} n={theirN} />
      </div>
      <p className={`mt-3 text-sm font-semibold ${tone === "praise" ? "text-[var(--color-praise)]" : tone === "pain" ? "text-[var(--color-pain)]" : "text-[var(--color-ink-muted)]"}`}>
        {advantagePp == null
          ? "Waiting on both sides"
          : advantagePp > 0
            ? `${advantagePp.toFixed(0)} pp in your favour`
            : advantagePp < 0
              ? `${Math.abs(advantagePp).toFixed(0)} pp behind`
              : "Level"}
      </p>
    </div>
  );
}

function Rate({ name, value, n }: { name: string; value: number | null; n: number }) {
  return (
    <div>
      <p className="truncate text-xs text-[var(--color-ink-muted)]">{name}</p>
      <p className="font-[family-name:var(--font-display)] text-4xl">{formatPercent(value, 0)}</p>
      <p className="text-xs text-[var(--color-ink-muted)]">n={n}</p>
    </div>
  );
}

function Callout({
  title,
  tone,
  themes,
  empty,
}: {
  title: string;
  tone: "praise" | "pain" | "plain";
  themes: ThemeComparison[];
  empty: string;
}) {
  const klass = tone === "praise" ? "tone-praise" : tone === "pain" ? "tone-pain" : "border border-[var(--color-border)] bg-white";
  return (
    <section className={`rounded-2xl px-4 py-4 ${klass}`}>
      <h2 className="text-sm font-semibold tracking-wide uppercase">{title}</h2>
      {themes.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {themes.slice(0, 4).map((theme) => (
            <li key={theme.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{aspectLabel(theme.key)}</span>
                <span className="text-[var(--color-ink-muted)]">
                  {theme.painAdvantagePp == null
                    ? ""
                    : theme.painAdvantagePp > 0
                      ? `${theme.painAdvantagePp.toFixed(0)} pp less pain`
                      : `${Math.abs(theme.painAdvantagePp).toFixed(0)} pp more pain`}
                </span>
              </div>
              <div className="share-bar mt-1 bg-white/70">
                <span
                  className={tone === "pain" ? "bg-[var(--color-pain)]" : "bg-[var(--color-praise)]"}
                  style={{ width: `${Math.min(100, Math.abs(theme.painAdvantagePp ?? 0) * 2)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GapRow({
  theme,
  maxGap,
  ourName,
  theirName,
}: {
  theme: ThemeComparison;
  maxGap: number;
  ourName: string;
  theirName: string;
}) {
  const gap = theme.painAdvantagePp ?? 0;
  const favorable = gap > 0;
  const width = Math.max(6, (Math.abs(gap) / maxGap) * 100);
  return (
    <li>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{aspectLabel(theme.key)}</p>
        <span className={`text-sm font-semibold ${favorable ? "text-[var(--color-praise)]" : gap < 0 ? "text-[var(--color-pain)]" : "text-[var(--color-ink-muted)]"}`}>
          {gap > 0 ? `${gap.toFixed(0)} pp less pain` : gap < 0 ? `${Math.abs(gap).toFixed(0)} pp more pain` : "Level"}
          {theme.early ? " · early" : ""}
          {theme.sharedPain ? " · shared" : ""}
        </span>
      </div>
      <div className="share-bar mt-2 bg-[var(--color-surface-muted)]">
        <span className={favorable || gap === 0 ? "bg-[var(--color-praise)]" : "bg-[var(--color-pain)]"} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
        {ourName} {formatPercent(theme.ourPain, 0)} (n={theme.ourMentions}) · {theirName} {formatPercent(theme.theirPain, 0)} (n={theme.theirMentions})
      </p>
    </li>
  );
}

function byPain(themes: ThemeComparison[], side: "ours" | "theirs") {
  return [...themes]
    .filter((theme) => (side === "ours" ? theme.ourMentions : theme.theirMentions) >= 3)
    .sort((a, b) => (side === "ours" ? (b.ourPain ?? 0) - (a.ourPain ?? 0) : (b.theirPain ?? 0) - (a.theirPain ?? 0)))
    .slice(0, 5);
}

function RankColumn({
  title,
  name,
  themes,
  side,
}: {
  title: string;
  name: string;
  themes: ThemeComparison[];
  side: "ours" | "theirs";
}) {
  return (
    <section className="rounded-2xl p-4 tone-pain">
      <h2 className="text-sm font-semibold text-[var(--color-pain)]">{title}</h2>
      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{name} · share of negative mentions</p>
      {themes.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-ink-muted)]">Not enough mentions yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {themes.map((theme, index) => {
            const shown = side === "ours" ? theme.ourPain : theme.theirPain;
            const mentions = side === "ours" ? theme.ourMentions : theme.theirMentions;
            return (
              <li key={theme.key}>
                <div className="grid grid-cols-[1.25rem_1fr_auto] gap-2 text-sm">
                  <span className="font-semibold text-[var(--color-pain)]">{index + 1}</span>
                  <span className="font-medium">{aspectLabel(theme.key)}</span>
                  <span>{formatPercent(shown, 0)}</span>
                </div>
                <div className="share-bar mt-1.5 ml-7 bg-white/80">
                  <span className="bg-[var(--color-pain)]" style={{ width: `${Math.max(4, (shown ?? 0) * 100)}%` }} />
                </div>
                <p className="mt-1 ml-7 text-xs text-[var(--color-ink-muted)]">n={mentions}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
