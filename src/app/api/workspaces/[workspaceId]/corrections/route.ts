import { NextResponse } from "next/server";
import { CorrectionSchema } from "@/shared/schemas/domain";
import { AuthError, requireMembership } from "@/server/auth/permissions";

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const body = CorrectionSchema.parse({
      ...(await request.json()),
      workspaceId,
    });
    const { supabase, user } = await requireMembership(workspaceId, ["owner", "editor"]);

    const { data: classification } = await supabase
      .from("classifications")
      .select("id, feedback_id")
      .eq("id", body.classificationId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!classification) {
      return NextResponse.json({ error: "Classification not found" }, { status: 404 });
    }

    const { data: correction, error } = await supabase
      .from("corrections")
      .insert({
        workspace_id: workspaceId,
        classification_id: body.classificationId,
        feedback_id: body.feedbackId,
        field: body.field,
        previous_value: body.previousValue,
        new_value: body.newValue,
        note: body.note,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Versioned override — do not destroy original classification output.
    if (body.field === "aspects") {
      await supabase
        .from("classifications")
        .update({ aspects: body.newValue })
        .eq("id", body.classificationId);
    }

    // Invalidate active metric snapshots so they recompute on next aggregation.
    await supabase
      .from("metric_snapshots")
      .update({ active: false })
      .eq("workspace_id", workspaceId)
      .eq("active", true);

    await supabase.from("audit_events").insert({
      workspace_id: workspaceId,
      actor_user_id: user.id,
      action: "classification.corrected",
      target_type: "correction",
      target_id: correction.id,
    });

    return NextResponse.json({ correction }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid correction" },
      { status: 400 },
    );
  }
}
