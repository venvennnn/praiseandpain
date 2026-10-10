import { WorkspaceShell } from "@/components/workspace/shell";
import { loadWorkspaceContext } from "@/lib/workspace-page";
import { TaskBoard } from "@/components/tasks/board";

export default async function TasksPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await loadWorkspaceContext(workspaceId);
  const { data: tasks } = await ctx.supabase
    .from("tasks")
    .select("*, task_evidence(feedback_id)")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  const { data: interventions } = await ctx.supabase
    .from("interventions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("implemented_at", { ascending: false })
    .limit(20);

  return (
    <WorkspaceShell
      workspaceId={workspaceId}
      workspaceName={ctx.workspace.name}
      providerStatus={ctx.providerStatus}
      active="tasks"
    >
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Tasks</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        Needs Attention, In Progress, Monitoring, and Closed. Effort is user-entered for
        priority-versus-effort views — not a revenue forecast.
      </p>
      <TaskBoard
        workspaceId={workspaceId}
        tasks={tasks ?? []}
        interventions={interventions ?? []}
        canEdit={ctx.role === "owner" || ctx.role === "editor"}
      />
    </WorkspaceShell>
  );
}
