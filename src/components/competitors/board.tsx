"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  const [brief, setBrief] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const head = heads.find((item) => item.competitorId === selectedId) ?? heads[0];

  async function writeBrief() {
    if (!head) return;
    setWriting(true);
    setBriefError(null);
    const res = await fetch(`/api/workspaces/${workspaceId}/compare-brief`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitorId: head.competitorId }),
    });
    const json = await res.json();
    setWriting(false);
    if (!res.ok) {
      setBriefError(json.error ?? "Could not write the brief");
      return;
    }
    setBrief(json.brief ?? null);
  }

  if (!head) {
    return (
      <p className="mt-6 text-sm text-[var(--color-ink-muted)]">
        Add a competitor to see where {ourName} leads and where it trails.
      </p>
    );
  }

  const ahead = head.themes.filter((theme) => theme.stance === "ahead");
  const behind = head.themes.filter((theme) => theme.stance === "behind");
  const shared = head.themes.filter((theme) => theme.sharedPain);

  return (
    <div className="mt-8 space-y-8">
      {heads.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {heads.map((item) => (
            <button
              key={item.competitorId}
              type="button"
              onClick={() => {
                setSelectedId(item.competitorId);
                setBrief(null);
                setBriefError(null);
              }}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                item.competitorId === head.competitorId
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                  : "border-[var(--color-border)] bg-white hover:-translate-y-0.5"
              }`}
            >
              vs {item.competitorName}
            </button>
          ))}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2">
        <ScoreCard
          label="Positive share"
          ours={head.ourPraiseRate}
          theirs={head.theirPraiseRate}
          ourN={head.ourSampled}
          theirN={head.theirSampled}
          advantagePp={head.praiseAdvantagePp}
          goodWhenPositive
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
          goodWhenPositive
          ourName={ourName}
          theirName={head.competitorName}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <Callout title="You lead" tone="praise" themes={ahead} empty="No theme where your gap is at least 8 percentage points." />
        <Callout title="They lead" tone="pain" themes={behind} empty="No theme where they are clearly ahead." />
        <Callout title="Shared pain" tone="plain" themes={shared} empty="No theme where both sides are at least 35% pain." />
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">Theme by theme</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Pain share of mentions. A theme needs at least 5 mentions on each side. Under 8 percentage points counts as close.
          Fewer than 15 mentions on either side is an early read.
        </p>
        <ul className="mt-5 space-y-4">
          {head.themes.length === 0 ? (
            <li className="text-sm text-[var(--color-ink-muted)]">
              Sync both places and let classification finish. Theme gaps appear from those scores.
            </li>
          ) : (
            head.themes.map((theme) => <ThemeRow key={theme.key} theme={theme} ourName={ourName} theirName={head.competitorName} />)
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">Brief</h2>
          {geminiReady ? (
            <Button type="button" variant="secondary" disabled={writing} onClick={writeBrief}>
              {writing ? "Writing…" : "Rewrite with Gemini"}
            </Button>
          ) : null}
        </div>
        <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-ink)]">
          {(brief ? [brief] : head.lines).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
          {brief
            ? "Gemini rewrote the calculated brief. It was told to use only these scores."
            : geminiReady
              ? "This brief is calculated from the scores. Gemini can rewrite the wording without adding new numbers."
              : "This brief is calculated from the scores. Add GEMINI_API_KEY if you want Gemini to rewrite it. The key is optional."}
        </p>
        {briefError ? <p className="mt-2 text-sm text-[var(--color-pain)]">{briefError}</p> : null}
      </section>
    </div>
  );
}

function ScoreCard({
  label,
  ours,
  theirs,
  ourN,
  theirN,
  advantagePp,
  goodWhenPositive,
  ourName,
  theirName,
}: {
  label: string;
  ours: number | null;
  theirs: number | null;
  ourN: number;
  theirN: number;
  advantagePp: number | null;
  goodWhenPositive: boolean;
  ourName: string;
  theirName: string;
}) {
  const favorable = advantagePp != null && (goodWhenPositive ? advantagePp > 0 : advantagePp < 0);
  const tone = advantagePp == null ? "plain" : favorable ? "praise" : advantagePp === 0 ? "plain" : "pain";
  return (
    <div className={`rounded-xl px-4 py-4 ${tone === "praise" ? "tone-praise" : tone === "pain" ? "tone-pain" : "border border-[var(--color-border)] bg-white"}`}>
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
      <p className="font-[family-name:var(--font-display)] text-3xl">{formatPercent(value, 0)}</p>
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
    <section className={`rounded-xl px-4 py-4 ${klass}`}>
      <h2 className="text-sm font-semibold tracking-wide uppercase">{title}</h2>
      {themes.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {themes.slice(0, 4).map((theme) => (
            <li key={theme.key} className="text-sm">
              <span className="font-medium">{aspectLabel(theme.key)}</span>
              <span className="text-[var(--color-ink-muted)]">
                {" "}
                {theme.painAdvantagePp == null
                  ? ""
                  : theme.painAdvantagePp > 0
                    ? `${theme.painAdvantagePp.toFixed(0)} pp less pain`
                    : `${Math.abs(theme.painAdvantagePp).toFixed(0)} pp more pain`}
                {theme.early ? " · early" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ThemeRow({
  theme,
  ourName,
  theirName,
}: {
  theme: ThemeComparison;
  ourName: string;
  theirName: string;
}) {
  const stanceLabel: Record<ThemeComparison["stance"], string> = {
    ahead: "You lead",
    behind: "They lead",
    split: "Split",
    close: "Close",
    thin: "Thin sample",
  };
  const pill =
    theme.stance === "ahead"
      ? "bg-[var(--color-praise)] text-white"
      : theme.stance === "behind"
        ? "bg-[var(--color-pain)] text-white"
        : "border border-[var(--color-border)] bg-white text-[var(--color-ink-muted)]";
  return (
    <li className={theme.stance === "thin" ? "opacity-70" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{aspectLabel(theme.key)}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pill}`}>
          {stanceLabel[theme.stance]}
          {theme.sharedPain ? " · shared pain" : ""}
        </span>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Bar name={ourName} value={theme.ourPain} n={theme.ourMentions} />
        <Bar name={theirName} value={theme.theirPain} n={theme.theirMentions} />
      </div>
    </li>
  );
}

function Bar({ name, value, n }: { name: string; value: number | null; n: number }) {
  const width = value == null ? 0 : Math.max(0, Math.min(100, value * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-[var(--color-ink-muted)]">
        <span className="truncate">{name}</span>
        <span>
          {formatPercent(value, 0)} · n={n}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-[var(--color-border)]">
        <div className="h-full rounded-full bg-[var(--color-pain)] transition-all duration-700" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
