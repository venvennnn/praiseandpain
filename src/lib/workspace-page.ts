import { notFound, redirect } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { serpApiConfigured } from "@/server/connectors";
import { jevConfigured } from "@/server/jev/client";

export async function loadWorkspaceContext(workspaceId: string) {
  if (!supabaseConfigured()) {
    redirect("/app");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("role, workspace:workspaces(*)")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  const workspace = Array.isArray(membership?.workspace)
    ? membership?.workspace[0]
    : membership?.workspace;

  if (!membership || !workspace || workspace.deleted_at) notFound();

  return {
    supabase,
    user,
    role: membership.role as string,
    workspace: workspace as Record<string, unknown> & {
      id: string;
      name: string;
      kind: string;
      timezone: string;
    },
    providerStatus: {
      serpapi: serpApiConfigured(),
      jev: jevConfigured(),
    },
  };
}
