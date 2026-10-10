import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace/shell";
import { MetricCard } from "@/components/metric/metric-card";
import { AspectBars } from "@/components/charts/aspect-bars";
import { Button } from "@/components/ui/button";
import { loadWorkspaceContext } from "@/lib/workspace-page";
import type { MetricResult } from "@/shared/schemas/metrics";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await loadWorkspaceContext(workspaceId);

  const { data: snapshot } = await ctx.supabase
    .from("metric_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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

  const chartData = Object.entries(metrics).map(([aspect, m]) => ({
    aspect,
    praise: m.praise_share?.value ?? null,
    pain: m.complaint_share?.value ?? null,
    mentions: m.complaint_share?.denominator ?? m.praise_share?.denominator ?? 0,
  }));

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
        <form action={`/api/workspaces/${workspaceId}/sync`} method="post">
          <SyncButton workspaceId={workspaceId} disabled={!ctx.providerStatus.serpapi} />
        </form>
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-sm text-[var(--color-ink-muted)]">
        <span>{feedbackCount ?? 0} feedback records</span>
        <span>
          Refresh:{" "}
          {run
            ? `${run.status}${run.stage ? ` · ${run.stage}` : ""}`
            : "No runs yet"}
        </span>
      </div>

      {!ctx.providerStatus.serpapi || !ctx.providerStatus.jev ? (
        <div className="mt-4 border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm">
          {!ctx.providerStatus.serpapi
            ? "Live collection is disabled until SERPAPI_API_KEY is set. You can still import CSV/JSON from Settings."
            : null}{" "}
          {!ctx.providerStatus.jev
            ? "Classification is paused until TYPESAFE_API_KEY is set. Metrics stay empty rather than inventing labels."
            : null}
        </div>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-3">
        <section>
          <h2 className="text-sm font-semibold tracking-wide text-[var(--color-praise)] uppercase">
            Praise
          </h2>
          <MetricCard title="Top strength" metric={topPraise?.metric} />
          {topPraise ? (
            <p className="text-sm text-[var(--color-ink)]">{topPraise.key}</p>
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
            <p className="text-sm text-[var(--color-ink)]">{topPain.key}</p>
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

function SyncButton({
  workspaceId,
  disabled,
}: {
  workspaceId: string;
  disabled: boolean;
}) {
  return (
    <Button asChild disabled={disabled} title={disabled ? "SerpApi key required for live sync" : "Sync feedback"}>
      <Link href={`/w/${workspaceId}/settings#import`}>
        {disabled ? "Import feedback" : "Refresh data"}
      </Link>
    </Button>
  );
}
