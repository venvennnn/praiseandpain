import type { MemberRole } from "@/shared/schemas/domain";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new AuthError("Authentication required", 401);
  }
  return { supabase, user: data.user };
}

export async function requireMembership(
  workspaceId: string,
  roles?: MemberRole[],
) {
  const { supabase, user } = await requireUser();
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !membership) {
    throw new AuthError("Workspace access denied", 403);
  }
  if (roles && !roles.includes(membership.role as MemberRole)) {
    throw new AuthError("Insufficient permissions", 403);
  }
  return { supabase, user, role: membership.role as MemberRole };
}

/** Workers must independently validate workspace/job ownership with service role. */
export async function assertRunOwnership(runId: string, workspaceId: string) {
  const service = createServiceClient();
  const { data, error } = await service
    .from("collection_runs")
    .select("id, workspace_id, status")
    .eq("id", runId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error || !data) {
    throw new AuthError("Run not found for workspace", 404);
  }
  return data;
}
