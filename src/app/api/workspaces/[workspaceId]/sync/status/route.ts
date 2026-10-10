import { NextResponse } from "next/server";
import { AuthError, requireMembership } from "@/server/auth/permissions";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const { supabase } = await requireMembership(workspaceId);
    const { data: run } = await supabase
      .from("collection_runs")
      .select("id, status, stage, progress, error, started_at, completed_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count } = await supabase
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    const { count: classified } = await supabase
      .from("classifications")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    return NextResponse.json({
      run,
      feedbackCount: count ?? 0,
      classifiedCount: classified ?? 0,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Status unavailable" }, { status: 400 });
  }
}
