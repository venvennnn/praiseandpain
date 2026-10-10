import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace/shell";
import { loadWorkspaceContext } from "@/lib/workspace-page";
import { formatPercent } from "@/lib/utils";
import { aspectLabel } from "@/server/jev/taxonomy";
import type { ComparisonResult, MetricResult } from "@/shared/schemas/metrics";

export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await loadWorkspaceContext(workspaceId);

  const { data: links } = await ctx.supabase
    .from("workspace_entities")
    .select("role, entity:entities(id, name)")
    .eq("workspace_id", workspaceId);

  const entities = (links ?? []).map((l) => ({
    role: l.role as string,
    entity: (Array.isArray(l.entity) ? l.entity[0] : l.entity) as {
      id: string;
      name: string;
    },
  }));
  const primary = entities.find((e) => e.role === "primary");
  const competitors = entities.filter((e) => e.role === "competitor");

  const { data: snapshots } = await ctx.supabase
    .from("metric_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("active", true);

  const { data: comparison } = await ctx.supabase
    .from("comparison_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const aspects = new Set<string>();
  for (const snap of snapshots ?? []) {
    for (const key of Object.keys((snap.metrics as object) ?? {})) aspects.add(key);
  }
  const aspectList = [...aspects];

  function cell(entityId: string, aspect: string) {
    const snap = (snapshots ?? []).find((s) => s.entity_id === entityId);
    const metric = (snap?.metrics as Record<string, { complaint_share?: MetricResult; praise_share?: MetricResult }>)?.[
      aspect
    ];
    return metric;
  }

  const results = (comparison?.results as ComparisonResult[]) ?? [];

  const protect: string[] = [];
  const closeGap: string[] = [];
  const highlight: string[] = [];
  const shared: string[] = [];

  for (const aspect of aspectList) {
    if (!primary) break;
    const ours = cell(primary.entity.id, aspect);
    const praise = ours?.praise_share?.value ?? null;
    const pain = ours?.complaint_share?.value ?? null;
    const competitorPains = competitors.map((c) => cell(c.entity.id, aspect)?.complaint_share?.value ?? null);

    if (praise != null && praise >= 0.5) protect.push(aspect);
    if (pain != null && competitorPains.some((p) => p != null && p < pain)) closeGap.push(aspect);
    const adv = results.find(
      (r) =>
        r.interpretation === "advantage" &&
        r.matchedFilters.aspectId === null &&
        r.entityAId === primary.entity.id,
    );
    if (adv && praise != null && praise > 0) highlight.push(aspect);
    if (pain != null && competitorPains.some((p) => p != null && Math.abs(p - pain) < 0.1)) {
      shared.push(aspect);
    }
  }

  return (
    <WorkspaceShell
      workspaceId={workspaceId}
      workspaceName={ctx.workspace.name}
      providerStatus={ctx.providerStatus}
      active="competitors"
    >
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Competitors</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        Source-aware comparison matrix. Intervals describe sample uncertainty, not selection bias.
        Public engagement counts are optional context, not causal impact.
      </p>

      {!primary ? (
        <p className="mt-8 text-sm">
          Register your primary entity first.{" "}
          <Link className="text-[var(--color-action)]" href={`/w/${workspaceId}/onboarding/entity`}>
            Continue onboarding
          </Link>
        </p>
      ) : (
        <>
          <div className="mt-8 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-ink-muted)]">
                  <th className="py-3 pr-4 font-medium">Topic</th>
                  <th className="bg-[var(--color-highlight)] py-3 pr-4 font-medium">
                    {primary.entity.name} (you)
                  </th>
                  {competitors.map((c) => (
                    <th key={c.entity.id} className="py-3 pr-4 font-medium">
                      {c.entity.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aspectList.length === 0 ? (
                  <tr>
                    <td className="py-6 text-[var(--color-ink-muted)]" colSpan={2 + competitors.length}>
                      No comparison metrics yet. Import or sync feedback, then classify.
                    </td>
                  </tr>
                ) : (
                  aspectList.map((aspect) => (
                    <tr key={aspect} className="border-b border-[var(--color-border)] align-top">
                      <td className="py-3 pr-4 font-medium">{aspectLabel(aspect)}</td>
                      {[primary, ...competitors].map((col, idx) => {
                        const m = cell(col.entity.id, aspect);
                        const complaint = m?.complaint_share;
                        const praise = m?.praise_share;
                        return (
                          <td
                            key={col.entity.id}
                            className={`py-3 pr-4 ${idx === 0 ? "bg-[var(--color-highlight)]" : ""}`}
                          >
                            {complaint?.status === "unavailable" && praise?.status === "unavailable" ? (
                              <span className="text-[var(--color-ink-muted)]">Insufficient data</span>
                            ) : (
                              <div>
                                <div className="text-[var(--color-praise)]">
                                  + {formatPercent(praise?.value, 0)}
                                </div>
                                <div className="text-[var(--color-pain)]">
                                  − {formatPercent(complaint?.value, 0)}
                                </div>
                                <div className="text-xs text-[var(--color-ink-muted)]">
                                  n={complaint?.denominator ?? praise?.denominator ?? 0}
                                  {complaint?.interval
                                    ? ` · CI ${formatPercent(complaint.interval.lower, 0)}–${formatPercent(complaint.interval.upper, 0)}`
                                    : ""}
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <InsightList
              title="Protect Your Strengths"
              items={protect}
              empty="Need positive evidence about your entity before listing strengths."
              workspaceId={workspaceId}
            />
            <InsightList
              title="Close the Gap"
              items={closeGap}
              empty="No gaps with sufficient matched data."
              workspaceId={workspaceId}
            />
            <InsightList
              title="Highlight Your Advantage"
              items={highlight}
              empty="Advantage only shown with positive evidence about you plus posterior threshold."
              workspaceId={workspaceId}
            />
            <InsightList
              title="Explore Shared Needs"
              items={shared}
              empty="No shared needs detected yet."
              workspaceId={workspaceId}
            />
          </div>
        </>
      )}
    </WorkspaceShell>
  );
}

function InsightList({
  title,
  items,
  empty,
  workspaceId,
}: {
  title: string;
  items: string[];
  empty: string;
  workspaceId: string;
}) {
  return (
    <section>
      <h2 className="font-[family-name:var(--font-display)] text-xl">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item} className="border-b border-[var(--color-border)] py-2 text-sm">
              <Link
                href={`/w/${workspaceId}/feedback?q=${encodeURIComponent(item)}`}
                className="text-[var(--color-action)]"
              >
                {item}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
