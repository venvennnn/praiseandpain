import { WorkspaceShell } from "@/components/workspace/shell";
import { loadWorkspaceContext } from "@/lib/workspace-page";
import { SettingsPanel } from "@/components/settings/panel";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await loadWorkspaceContext(workspaceId);

  const { data: entities } = await ctx.supabase
    .from("workspace_entities")
    .select("role, entity:entities(id, name, source, provider_id, url, metadata)")
    .eq("workspace_id", workspaceId);

  const { data: members } = await ctx.supabase
    .from("memberships")
    .select("id, role, user_id")
    .eq("workspace_id", workspaceId);

  return (
    <WorkspaceShell
      workspaceId={workspaceId}
      workspaceName={ctx.workspace.name}
      providerStatus={ctx.providerStatus}
      active="settings"
    >
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Settings</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        Owners manage membership and retention. Missing provider keys disable live collection
        with guidance — they never silently substitute results.
      </p>
      <SettingsPanel
        workspaceId={workspaceId}
        workspace={ctx.workspace}
        role={ctx.role}
        providerStatus={ctx.providerStatus}
        entities={(entities ?? []).map((e) => ({
          role: e.role as string,
          entity: (Array.isArray(e.entity) ? e.entity[0] : e.entity) as {
            id: string;
            name: string;
            source: string;
            provider_id: string;
            url: string | null;
            metadata: Record<string, unknown>;
          },
        }))}
        members={members ?? []}
      />
    </WorkspaceShell>
  );
}
