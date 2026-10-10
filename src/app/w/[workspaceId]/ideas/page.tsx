import { WorkspaceShell } from "@/components/workspace/shell";
import { loadWorkspaceContext } from "@/lib/workspace-page";
import { IdeasBoard } from "@/components/ideas/board";

export default async function IdeasPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await loadWorkspaceContext(workspaceId);
  const { data: ideas } = await ctx.supabase
    .from("content_ideas")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  return (
    <WorkspaceShell
      workspaceId={workspaceId}
      workspaceName={ctx.workspace.name}
      providerStatus={ctx.providerStatus}
      active="ideas"
    >
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Creator backlog</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        Considering → Planned → Published. Audience evidence stays separate from content
        analysis. Transcripts are analysed only when available — never invented.
      </p>
      <IdeasBoard
        workspaceId={workspaceId}
        ideas={ideas ?? []}
        canEdit={ctx.role === "owner" || ctx.role === "editor"}
        isCreator={ctx.workspace.kind === "creator"}
      />
    </WorkspaceShell>
  );
}
