"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Run = {
  id: string;
  status: string;
  stage: string | null;
  progress: Record<string, unknown> | null;
  error: string | null;
};

const STAGES = [
  { key: "discover", label: "Find" },
  { key: "collect", label: "Collect" },
  { key: "classify", label: "Classify" },
  { key: "aggregate", label: "Scores" },
] as const;

function stageIndexFor(run: Run | null): number {
  if (!run) return 0;
  if (run.status === "completed") return STAGES.length;
  if (run.stage === "classify") return 2;
  if (run.stage === "aggregate" || run.stage === "compare" || run.stage === "summarise") return 3;
  if (run.stage === "collect" || run.stage === "normalise") return 1;
  return 0;
}

const STAGE_FLOOR: Record<string, number> = {
  discover: 8,
  collect: 28,
  normalise: 40,
  classify: 55,
  aggregate: 88,
  compare: 94,
  summarise: 98,
};

export function SyncLive({
  workspaceId,
  initialRun,
  initialCount,
  serpapiReady,
  jevReady,
  inngestReady,
  planLabelText,
}: {
  workspaceId: string;
  initialRun: Run | null;
  initialCount: number;
  serpapiReady: boolean;
  jevReady: boolean;
  inngestReady: boolean;
  planLabelText: string;
}) {
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(initialRun);
  const [count, setCount] = useState(initialCount);
  const [classified, setClassified] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ready = serpapiReady && jevReady && inngestReady;
  const active = run?.status === "queued" || run?.status === "running";

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/sync/status`);
      if (!res.ok) return;
      const json = await res.json();
      setRun(json.run ?? null);
      setCount(json.feedbackCount ?? 0);
      setClassified(json.classifiedCount ?? 0);
      if (json.run?.status === "completed" || json.run?.status === "failed") {
        router.refresh();
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [active, workspaceId, router]);

  const progress = progressPercent(run, count, classified);
  const stageIndex = stageIndexFor(run);

  async function sync() {
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/workspaces/${workspaceId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, forceFull: false }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(typeof json.error === "string" ? json.error : "Sync failed");
      return;
    }
    setMessage("Sync started. Pulling the newest reviews…");
    setRun({ id: json.runId, status: "queued", stage: "discover", progress: null, error: null });
    router.refresh();
  }

  return (
    <section className="mt-6 rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-[0_8px_30px_rgba(42,47,56,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            {count.toLocaleString()} reviews in workspace
          </p>
          <p className="text-xs text-[var(--color-ink-muted)]">{planLabelText}</p>
        </div>
        {ready ? (
          <Button onClick={sync} disabled={loading || active}>
            {active ? "Syncing…" : loading ? "Starting…" : "Sync live feedback"}
          </Button>
        ) : (
          <Button disabled>Sync blocked</Button>
        )}
      </div>

      <ol className="mt-4 grid grid-cols-4 gap-2">
        {STAGES.map((stage, index) => {
          const state = !run
            ? "idle"
            : run.status === "failed" && index === stageIndex
              ? "failed"
              : index < stageIndex || run.status === "completed"
                ? "done"
                : index === stageIndex
                  ? "active"
                  : "idle";
          return (
            <li key={stage.key} className="min-w-0">
              <div
                className={`stage-dot mb-1 h-1.5 rounded-full ${
                  state === "done"
                    ? "bg-[var(--color-praise)]"
                    : state === "active"
                      ? "progress-sheen"
                      : state === "failed"
                        ? "bg-[var(--color-pain)]"
                        : "bg-[var(--color-surface-muted)]"
                }`}
                data-state={state}
              />
              <p
                className={`truncate text-[11px] ${
                  state === "active" ? "font-semibold text-[var(--color-ink)]" : "text-[var(--color-ink-muted)]"
                }`}
              >
                {stage.label}
              </p>
            </li>
          );
        })}
      </ol>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-[var(--color-ink-muted)]">
          <span>{stageCopy(run)}</span>
          <span>{active ? `${progress}%` : run?.status === "completed" ? "Done" : ""}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              run?.status === "failed"
                ? "bg-[var(--color-pain)]"
                : run?.status === "completed"
                  ? "bg-[var(--color-praise)]"
                  : "bg-[var(--color-action)]"
            } ${active ? "progress-sheen" : ""}`}
            style={{ width: `${run ? progress : 0}%` }}
          />
        </div>
      </div>

      {message ? <p className="mt-3 text-sm text-[var(--color-ink)]">{message}</p> : null}
      {run?.error ? <p className="mt-2 text-sm text-[var(--color-pain)]">{run.error}</p> : null}
      {run?.status === "completed" ? (
        <p className="mt-3 text-sm text-[var(--color-praise)]">
          Latest sync finished. Praise is green, pain is red, everything else stays white.
        </p>
      ) : null}
    </section>
  );
}

function progressPercent(run: Run | null, count: number, classified: number | null): number {
  if (!run) return 0;
  if (run.status === "completed") return 100;
  if (run.status === "failed") return STAGE_FLOOR[run.stage ?? "collect"] ?? 20;
  const floor = STAGE_FLOOR[run.stage ?? "discover"] ?? 10;
  const progress = run.progress ?? {};
  const remaining = Number(progress.remaining ?? NaN);
  const soFar = Number(progress.classifiedSoFar ?? classified ?? NaN);
  if (run.stage === "classify" && Number.isFinite(soFar) && Number.isFinite(remaining) && soFar + remaining > 0) {
    const ratio = soFar / (soFar + remaining);
    return Math.min(92, Math.round(45 + ratio * 42));
  }
  if (run.stage === "collect") {
    const covered = Number(progress.covered ?? NaN);
    const limit = Number(progress.perEntityLimit ?? NaN);
    const entityCount = Number(progress.entityCount ?? 1);
    const entityIndex = Number(progress.entityIndex ?? 0);
    if (Number.isFinite(covered) && Number.isFinite(limit) && limit > 0) {
      const ratio = (entityIndex + Math.min(1, covered / limit)) / Math.max(1, entityCount);
      return Math.min(48, Math.round(12 + ratio * 34));
    }
    if (count > 0) return Math.min(44, 18 + Math.min(26, Math.round(count / 20)));
  }
  return floor;
}

function stageCopy(run: Run | null): string {
  if (!run) return "No sync yet";
  if (run.status === "completed") return "Up to date";
  if (run.status === "failed") return "Sync failed";
  if (run.status === "queued") return "Queued — waiting for the worker";
  const labels: Record<string, string> = {
    discover: "Finding the place",
    collect: "Collecting newest reviews",
    classify: "Classifying praise and pain",
    aggregate: "Building the dashboard",
    compare: "Comparing competitors",
    summarise: "Finishing up",
  };
  return labels[run.stage ?? ""] ?? "Working";
}
