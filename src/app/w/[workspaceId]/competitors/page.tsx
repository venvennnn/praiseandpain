import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace/shell";
import { loadWorkspaceContext } from "@/lib/workspace-page";
import { AddCompetitor } from "@/components/competitors/add-competitor";
import { CompetitorBoard } from "@/components/competitors/board";
import { buildHeadToHead, profileFromSnapshot } from "@/server/analysis/head-to-head";
import { aspectLabel } from "@/server/jev/taxonomy";
import { geminiConfigured } from "@/server/gemini/brief";

export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await loadWorkspaceContext(workspaceId);

  const { data: links } = await ctx.supabase
    .from("workspace_entities")
    .select("role, entity_id, entity:entities(id, name)")
    .eq("workspace_id", workspaceId);

  const places = (links ?? []).map((link) => {
    const entity = Array.isArray(link.entity) ? link.entity[0] : link.entity;
    return {
      id: link.entity_id as string,
      name: entity?.name ?? "Place",
      role: link.role as string,
    };
  });
  const primary = places.find((place) => place.role === "primary");
  const competitors = places.filter((place) => place.role === "competitor");

  const { data: snapshots } = await ctx.supabase
    .from("metric_snapshots")
    .select("entity_id, metrics, coverage")
    .eq("workspace_id", workspaceId)
    .eq("active", true);

  const snapFor = (id: string) => (snapshots ?? []).find((row) => row.entity_id === id);
  const heads = primary
    ? competitors.map((competitor) => {
        const ours = profileFromSnapshot({
          id: primary.id,
          name: primary.name,
          metrics: snapFor(primary.id)?.metrics as never,
          coverage: snapFor(primary.id)?.coverage as never,
        });
        const theirs = profileFromSnapshot({
          id: competitor.id,
          name: competitor.name,
          metrics: snapFor(competitor.id)?.metrics as never,
          coverage: snapFor(competitor.id)?.coverage as never,
        });
        const labels: Record<string, string> = {};
        for (const theme of [...ours.themes, ...theirs.themes]) labels[theme.key] = aspectLabel(theme.key);
        return buildHeadToHead(ours, theirs, labels);
      })
    : [];

  return (
    <WorkspaceShell
      workspaceId={workspaceId}
      workspaceName={ctx.workspace.name}
      providerStatus={ctx.providerStatus}
      active="competitors"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Competitors</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-ink-muted)]">
            Head to head on the newest reviews in your plan. Green means the gap is in your favour.
            Red means they are ahead. A theme with a thin sample stays quiet.
          </p>
        </div>
        <p className="text-sm text-[var(--color-ink-muted)]">{competitors.length} of 3 competitors</p>
      </div>

      {!primary ? (
        <p className="mt-8 text-sm">
          Register your place first.{" "}
          <Link className="text-[var(--color-action)]" href={`/w/${workspaceId}/onboarding/entity`}>
            Continue onboarding
          </Link>
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          <AddCompetitor
            workspaceId={workspaceId}
            kind={ctx.workspace.kind}
            remaining={Math.max(0, 3 - competitors.length)}
            canEdit={ctx.role === "owner" || ctx.role === "editor"}
          />
          <CompetitorBoard
            workspaceId={workspaceId}
            ourName={primary.name}
            heads={heads}
            geminiReady={geminiConfigured()}
          />
        </div>
      )}
    </WorkspaceShell>
  );
}
