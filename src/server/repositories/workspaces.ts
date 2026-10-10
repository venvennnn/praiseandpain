import type { OnboardingInput } from "@/shared/schemas/onboarding";
import { aspectsForKind } from "@/server/jev/taxonomy";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { OnboardingInput };

export async function createWorkspaceWithDefaults(
  supabase: SupabaseClient,
  userId: string,
  input: OnboardingInput,
) {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({
      name: input.name,
      kind: input.kind,
      owner_user_id: userId,
      timezone: input.timezone,
      language: input.language,
      analysis_window_days: input.analysisWindowDays,
      refresh_cadence_hours: input.refreshCadenceHours,
      retrieval_budget: input.retrievalBudget,
    })
    .select("*")
    .single();

  if (error || !workspace) {
    throw new Error(error?.message ?? "Failed to create workspace");
  }

  const { error: memberError } = await supabase.from("memberships").insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: "owner",
  });
  if (memberError) throw new Error(memberError.message);

  const { data: taxonomy, error: taxError } = await supabase
    .from("taxonomy_versions")
    .insert({
      workspace_id: workspace.id,
      version: 1,
      label: "initial",
      active: true,
    })
    .select("*")
    .single();
  if (taxError || !taxonomy) throw new Error(taxError?.message ?? "taxonomy failed");

  const topics = aspectsForKind(input.kind).map((a) => ({
    workspace_id: workspace.id,
    taxonomy_version_id: taxonomy.id,
    key: a.key,
    name: a.name,
    definition: a.definition,
    domain: input.kind,
    status: "active",
  }));
  const { error: topicError } = await supabase.from("topics").insert(topics);
  if (topicError) throw new Error(topicError.message);

  await supabase.from("audit_events").insert({
    workspace_id: workspace.id,
    actor_user_id: userId,
    action: "workspace.created",
    target_type: "workspace",
    target_id: workspace.id,
  });

  return workspace;
}

export async function listWorkspacesForUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("memberships")
    .select("role, workspace:workspaces(*)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => ({
      role: row.role,
      workspace: Array.isArray(row.workspace) ? row.workspace[0] : row.workspace,
    }))
    .filter((r) => r.workspace && !(r.workspace as { deleted_at?: string }).deleted_at);
}
