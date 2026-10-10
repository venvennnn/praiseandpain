import type { OnboardingInput } from "@/shared/schemas/onboarding";
import { aspectsForKind } from "@/server/jev/taxonomy";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { OnboardingInput };

export async function createWorkspaceWithDefaults(
  supabase: SupabaseClient,
  userId: string,
  input: OnboardingInput,
) {
  // Prefer atomic RPC (security definer) so RLS bootstrap cannot fail mid-way.
  const { data: rpcWorkspace, error: rpcError } = await supabase.rpc("create_workspace", {
    p_name: input.name,
    p_kind: input.kind,
    p_timezone: input.timezone,
    p_language: input.language,
    p_analysis_window_days: input.analysisWindowDays,
    p_refresh_cadence_hours: input.refreshCadenceHours,
    p_retrieval_budget: input.retrievalBudget,
  });

  if (!rpcError && rpcWorkspace) {
    return Array.isArray(rpcWorkspace) ? rpcWorkspace[0] : rpcWorkspace;
  }

  // Fallback for DBs that have not applied the RPC migration yet.
  if (rpcError && !/Could not find the function|function .* does not exist/i.test(rpcError.message)) {
    throw new Error(rpcError.message);
  }

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
