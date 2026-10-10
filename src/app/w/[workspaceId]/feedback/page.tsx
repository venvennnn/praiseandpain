import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace/shell";
import { loadWorkspaceContext } from "@/lib/workspace-page";
import { FeedbackExplorer } from "@/components/feedback/explorer";
import { feedbackLimitForPlan, planLabel } from "@/shared/plans";

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { workspaceId } = await params;
  const sp = await searchParams;
  const ctx = await loadWorkspaceContext(workspaceId);
  const perEntityLimit = feedbackLimitForPlan((ctx.workspace as { plan?: string }).plan);

  const { data: entities } = await ctx.supabase
    .from("workspace_entities")
    .select("entity_id, entity:entities(id, name, source)")
    .eq("workspace_id", workspaceId);

  const buckets = await Promise.all(
    (entities ?? []).map(async (link) => {
      if (sp.entityId && sp.entityId !== link.entity_id) return [];
      let builder = ctx.supabase
        .from("feedback")
        .select(
          "id, original_text, published_at, source, rating, source_url, author_name, entity_id, classifications(id, status, is_praise, is_complaint, aspects, evidence_spans(id, excerpt, aspect_key, sentiment, start_offset, end_offset))",
        )
        .eq("workspace_id", workspaceId)
        .eq("entity_id", link.entity_id)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(perEntityLimit);
      if (sp.source) builder = builder.eq("source", sp.source);
      const { data } = await builder;
      return data ?? [];
    }),
  );

  let items = buckets.flat();
  if (sp.q) {
    const needle = sp.q.toLowerCase();
    items = items.filter((item) => item.original_text.toLowerCase().includes(needle));
  }
  items.sort((a, b) => {
    const left = a.published_at ? Date.parse(a.published_at) : 0;
    const right = b.published_at ? Date.parse(b.published_at) : 0;
    return right - left;
  });
  const shown = items.slice(0, 80);

  return (
    <WorkspaceShell
      workspaceId={workspaceId}
      workspaceName={ctx.workspace.name}
      providerStatus={ctx.providerStatus}
      active="feedback"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Feedback</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Green is praise, red is pain, and white is anything that is not clearly one or the other.
          </p>
        </div>
        <Link
          href={`/w/${workspaceId}/settings#import`}
          className="text-sm text-[var(--color-action)]"
        >
          Import CSV/JSON
        </Link>
      </div>
      <FeedbackExplorer
        workspaceId={workspaceId}
        initialItems={shown}
        entities={(entities ?? []).map((e) => {
          const ent = Array.isArray(e.entity) ? e.entity[0] : e.entity;
          return ent as { id: string; name: string; source: string };
        })}
        filters={sp}
        scopeLabel={`${planLabel((ctx.workspace as { plan?: string }).plan)}. Showing ${shown.length} of ${items.length} reviews inside that window.`}
      />
    </WorkspaceShell>
  );
}
