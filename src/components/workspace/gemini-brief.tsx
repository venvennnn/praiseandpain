"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GeminiBrief({
  title,
  ready,
  fallbackHeadline,
  fallback,
  endpoint,
  body,
}: {
  title: string;
  ready: boolean;
  fallbackHeadline: string;
  fallback: string[];
  endpoint: string;
  body?: Record<string, string>;
}) {
  const [brief, setBrief] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  async function write() {
    setWriting(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json();
    setWriting(false);
    if (!res.ok) {
      setError(json.error ?? "Could not write the summary");
      return;
    }
    setBrief(json.brief ?? null);
  }

  const lines = brief
    ? brief
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
  const headline = lines.length > 1 ? lines[0] : fallbackHeadline;
  const paragraphs = lines.length > 1 ? lines.slice(1) : brief ? [brief] : fallback;

  return (
    <section className="report-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-highlight)] text-[var(--color-action)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-action)] uppercase">{title}</p>
            <h2 className="font-[family-name:var(--font-display)] text-2xl leading-tight">{headline}</h2>
          </div>
        </div>
        {ready ? (
          <Button type="button" className="rounded-full" disabled={writing} onClick={write}>
            {writing ? "Writing…" : brief ? "Rewrite" : "Write with Gemini"}
          </Button>
        ) : null}
      </div>
      <div className="mt-4 space-y-2 text-sm leading-6 text-[var(--color-ink)]">
        {paragraphs.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
        {brief
          ? "Gemini wrote this from the calculated scores only."
          : ready
            ? "These lines are calculated from the scores. Gemini rewrites the wording and does not add numbers."
            : "These lines are calculated from the scores. Add GEMINI_API_KEY if you want Gemini to write the summary. The key is optional."}
      </p>
      {error ? <p className="mt-2 text-sm text-[var(--color-pain)]">{error}</p> : null}
    </section>
  );
}
