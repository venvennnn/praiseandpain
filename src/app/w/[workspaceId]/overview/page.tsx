import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace/shell";
import { MetricCard } from "@/components/metric/metric-card";
import { AspectBars } from "@/components/charts/aspect-bars";
import { SyncLive } from "@/components/workspace/sync-live";
import { loadWorkspaceContext } from "@/lib/workspace-page";
import type { MetricResult } from "@/shared/schemas/metrics";
import { integrationStatus } from "@/server/config/requirements";
import { planLabel } from "@/shared/plans";
import { aspectLabel } from "@/server/jev/taxonomy";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await loadWorkspaceContext(workspaceId);

  const { data: links } = await ctx.supabase
    .from("workspace_entities")
    .select("role, entity_id")
    .eq("workspace_id", workspaceId);
  const primaryId = (links ?? []).find((link) => link.role === "primary")?.entity_id;

  const { data: snapshots } = await ctx.supabase
    .from("metric_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  const snapshot =
    (snapshots ?? []).find((row) => row.entity_id === primaryId) ?? (snapshots ?? [])[0] ?? null;

  const { count: feedbackCount } = await ctx.supabase
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  const { data: run } = await ctx.supabase
    .from("collection_runs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: tasks } = await ctx.supabase
    .from("tasks")
    .select("id, title, status, priority")
    .eq("workspace_id", workspaceId)
    .neq("status", "closed")
    .order("priority", { ascending: false, nullsFirst: false })
    .limit(5);

  const metrics = (snapshot?.metrics ?? {}) as Record<
    string,
    { praise_share?: MetricResult; complaint_share?: MetricResult; prevalence?: MetricResult }
  >;

  const chartData = Object.entries(metrics)
    .filter(([aspect]) => aspect !== "unmatched" && aspect !== "none")
    .map(([aspect, m]) => ({
      aspect: aspectLabel(aspect),
      praise: m.praise_share?.value ?? null,
      pain: m.complaint_share?.value ?? null,
      mentions: m.complaint_share?.denominator ?? m.praise_share?.denominator ?? 0,
    }));

  const verdicts = (
    snapshot?.coverage as {
      verdicts?: { praise?: number; pain?: number; mixed?: number; plain?: number };
    } | null
  )?.verdicts;
  const praiseCount = verdicts?.praise ?? 0;
  const painCount = verdicts?.pain ?? 0;
  const plainCount = (verdicts?.mixed ?? 0) + (verdicts?.plain ?? 0);
  const verdictTotal = praiseCount + painCount + plainCount;

  const topPraise = Object.entries(metrics)
    .map(([k, m]) => ({ key: k, metric: m.praise_share }))
    .filter((x) => x.metric?.value != null)
    .sort((a, b) => (b.metric!.value ?? 0) - (a.metric!.value ?? 0))[0];

  const topPain = Object.entries(metrics)
    .map(([k, m]) => ({ key: k, metric: m.complaint_share }))
    .filter((x) => x.metric?.value != null)
    .sort((a, b) => (b.metric!.value ?? 0) - (a.metric!.value ?? 0))[0];

  return (
    <WorkspaceShell
      workspaceId={workspaceId}
      workspaceName={ctx.workspace.name}
      providerStatus={ctx.providerStatus}
      active="overview"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Overview</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Praise, Pain, and Next Moves for {ctx.workspace.name}
          </p>
        </div>
      </div>

      <SyncLive
        workspaceId={workspaceId}
        initialCount={feedbackCount ?? 0}
        initialRun={
          run
            ? {
                id: run.id,
                status: run.status,
                stage: run.stage,
                progress: (run.progress ?? null) as Record<string, unknown> | null,
                error: run.error,
              }
            : null
        }
        serpapiReady={ctx.providerStatus.serpapi}
        jevReady={ctx.providerStatus.jev}
        inngestReady={integrationStatus().inngest}
        planLabelText={planLabel((ctx.workspace as { plan?: string }).plan)}
      />

      <section className="animate-rise mt-6 rounded-xl border border-[var(--color-border)] bg-white p-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">Newest reviews</h2>
          <p className="text-xs text-[var(--color-ink-muted)]">
            {verdictTotal ? `${verdictTotal} classified in the plan window` : "Waiting for classification"}
          </p>
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-white ring-1 ring-[var(--color-border)]">
          {verdictTotal ? (
            <>
              <div
                className="mix-seg bg-[var(--color-praise)]"
                style={{ width: `${(praiseCount / verdictTotal) * 100}%` }}
              />
              <div
                className="mix-seg bg-[var(--color-pain)]"
                style={{ width: `${(painCount / verdictTotal) * 100}%`, animationDelay: "80ms" }}
              />
              <div className="mix-seg bg-white" style={{ width: `${(plainCount / verdictTotal) * 100}%` }} />
            </>
          ) : (
            <div className="h-full w-1/3 animate-pulse bg-[var(--color-surface-muted)]" />
          )}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <ToneStat label="Praise" value={verdictTotal ? praiseCount : null} tone="praise" />
          <ToneStat label="Pain" value={verdictTotal ? painCount : null} tone="pain" />
          <ToneStat label="Uncategorised" value={verdictTotal ? plainCount : null} tone="plain" />
        </div>
      </section>

      {!ctx.providerStatus.serpapi || !ctx.providerStatus.jev ? (
        <div className="mt-4 border border-[var(--color-pain)] bg-white px-4 py-3 text-sm">
          <p className="font-semibold text-[var(--color-pain)]">Live stack required</p>
          <p className="mt-1 text-[var(--color-ink)]">
            SerpApi collects real reviews/comments. TypeSafe/Jev classifies them with real
            algorithms. Neither is optional for the product path — configure the keys to sync.
            The app will not invent feedback or labels.
          </p>
        </div>
      ) : null}

      <div className="animate-rise-delay mt-10 grid gap-10 lg:grid-cols-3">
        <section>
          <h2 className="text-sm font-semibold tracking-wide text-[var(--color-praise)] uppercase">
            Praise
          </h2>
          <MetricCard title="Top strength" metric={topPraise?.metric} />
          {topPraise ? (
            <p className="text-sm text-[var(--color-ink)]">{aspectLabel(topPraise.key)}</p>
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">
              {feedbackCount ? "Awaiting classification" : "No feedback collected"}
            </p>
          )}
        </section>
        <section>
          <h2 className="text-sm font-semibold tracking-wide text-[var(--color-pain)] uppercase">
            Pain
          </h2>
          <MetricCard title="Open issue" metric={topPain?.metric} discloseMixed />
          {topPain ? (
            <p className="text-sm text-[var(--color-ink)]">{aspectLabel(topPain.key)}</p>
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">
              {feedbackCount ? "No complaint shares yet" : "No feedback collected"}
            </p>
          )}
        </section>
        <section>
          <h2 className="text-sm font-semibold tracking-wide text-[var(--color-action)] uppercase">
            Next moves
          </h2>
          <ul className="mt-4 space-y-3">
            {(tasks ?? []).length === 0 ? (
              <li className="text-sm text-[var(--color-ink-muted)]">
                No open tasks.{" "}
                <Link className="text-[var(--color-action)]" href={`/w/${workspaceId}/tasks`}>
                  Create one
                </Link>
              </li>
            ) : (
              (tasks ?? []).map((t) => (
                <li key={t.id} className="border-b border-[var(--color-border)] pb-2 text-sm">
                  <Link href={`/w/${workspaceId}/tasks`} className="font-medium">
                    {t.title}
                  </Link>
                  <div className="text-[var(--color-ink-muted)]">{t.status}</div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="mt-12">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">Aspect mix</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Praise and complaint shares by aspect with visible denominators.
        </p>
        <div className="mt-6">
          <AspectBars data={chartData} />
        </div>
      </section>
    </WorkspaceShell>
  );
}

function ToneStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: "praise" | "pain" | "plain";
}) {
  const toneClass =
    tone === "praise" ? "tone-praise" : tone === "pain" ? "tone-pain" : "tone-neutral border";
  const ink =
    tone === "praise"
      ? "text-[var(--color-praise)]"
      : tone === "pain"
        ? "text-[var(--color-pain)]"
        : "text-[var(--color-ink)]";
  return (
    <div className={`rounded-lg px-3 py-3 ${toneClass}`}>
      <p className={`text-xs font-semibold tracking-wide uppercase ${ink}`}>{label}</p>
      <p className={`mt-1 font-[family-name:var(--font-display)] text-2xl ${ink}`}>
        {value == null ? "—" : value}
      </p>
    </div>
  );
}
