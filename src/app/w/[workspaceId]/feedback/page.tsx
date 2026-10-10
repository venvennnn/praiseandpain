import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace/shell";
import { loadWorkspaceContext } from "@/lib/workspace-page";
import { FeedbackExplorer } from "@/components/feedback/explorer";

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

  let builder = ctx.supabase
    .from("feedback")
    .select(
      "id, original_text, published_at, source, rating, source_url, author_name, entity_id, classifications(id, status, is_praise, is_complaint, aspects, evidence_spans(id, excerpt, aspect_key, sentiment, start_offset, end_offset))",
    )
    .eq("workspace_id", workspaceId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(25);

  if (sp.q) builder = builder.ilike("original_text", `%${sp.q}%`);
  if (sp.source) builder = builder.eq("source", sp.source);
  if (sp.entityId) builder = builder.eq("entity_id", sp.entityId);

  const { data: items } = await builder;
  const { data: entities } = await ctx.supabase
    .from("workspace_entities")
    .select("entity:entities(id, name, source)")
    .eq("workspace_id", workspaceId);

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
            Search and filter with server-side pagination. Open evidence to correct labels.
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
        initialItems={items ?? []}
        entities={(entities ?? []).map((e) => {
          const ent = Array.isArray(e.entity) ? e.entity[0] : e.entity;
          return ent as { id: string; name: string; source: string };
        })}
        filters={sp}
      />
    </WorkspaceShell>
  );
}
