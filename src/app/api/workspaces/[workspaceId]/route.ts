import { NextResponse } from "next/server";
import { AuthError, requireMembership } from "@/server/auth/permissions";
import { createServiceClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const { user } = await requireMembership(workspaceId, ["owner"]);
    const service = createServiceClient();

    await service
      .from("collection_runs")
      .update({ status: "cancelled" })
      .eq("workspace_id", workspaceId)
      .in("status", ["queued", "running"]);

    await service
      .from("workspaces")
      .update({ deleted_at: new Date().toISOString(), paused: true })
      .eq("id", workspaceId);

    await service.from("raw_provider_payloads").delete().eq("workspace_id", workspaceId);
    await service.from("classification_cache").delete().eq("workspace_id", workspaceId);

    await service.from("audit_events").insert({
      workspace_id: workspaceId,
      actor_user_id: user.id,
      action: "workspace.deleted",
      target_type: "workspace",
      target_id: workspaceId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Delete failed" }, { status: 400 });
  }
}
