import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace/shell";
import { loadWorkspaceContext } from "@/lib/workspace-page";
import { Button } from "@/components/ui/button";

export default async function ReportsPage({
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

  const { data: alerts } = await ctx.supabase
    .from("alerts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <WorkspaceShell
      workspaceId={workspaceId}
      workspaceName={ctx.workspace.name}
      providerStatus={ctx.providerStatus}
      active="reports"
    >
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Reports</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        Digests are built from stored metrics. Optional model prose must cite evidence IDs and
        falls back to deterministic templates when validation fails.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <a href={`/api/workspaces/${workspaceId}/exports?format=csv`}>Export CSV</a>
        </Button>
        <Button asChild variant="secondary">
          <a href={`/api/workspaces/${workspaceId}/exports?format=html`}>Export HTML</a>
        </Button>
      </div>

      <section className="mt-10">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Weekly comparison</h2>
        {snapshot ? (
          <div className="mt-3 space-y-2 text-sm">
            <p>
              Period {new Date(snapshot.period_start).toLocaleDateString()} –{" "}
              {new Date(snapshot.period_end).toLocaleDateString()} · formula{" "}
              {snapshot.formula_version}
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {Object.keys((snapshot.metrics as object) ?? {}).map((aspect) => (
                <li key={aspect}>
                  <Link
                    href={`/w/${workspaceId}/feedback?q=${encodeURIComponent(aspect)}`}
                    className="text-[var(--color-action)]"
                  >
                    {aspect}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
            No active metric snapshot yet.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Alerts</h2>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Monitoring heuristics (7-day vs prior 28-day). Evaluate false alerts before scaling.
        </p>
        <ul className="mt-4 space-y-3">
          {(alerts ?? []).length === 0 ? (
            <li className="text-sm text-[var(--color-ink-muted)]">No alerts.</li>
          ) : (
            (alerts ?? []).map((a) => (
              <li key={a.id} className="border-b border-[var(--color-border)] py-2 text-sm">
                <div className="font-medium">{a.title}</div>
                <div className="text-[var(--color-ink-muted)]">{a.body}</div>
              </li>
            ))
          )}
        </ul>
      </section>
    </WorkspaceShell>
  );
}
