import { NextResponse } from "next/server";
import { CreateTaskSchema } from "@/shared/schemas/domain";
import { AuthError, requireMembership } from "@/server/auth/permissions";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const { supabase } = await requireMembership(workspaceId);
    const { data, error } = await supabase
      .from("tasks")
      .select("*, task_evidence(feedback_id)")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed" }, { status: 400 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const body = CreateTaskSchema.parse({
      ...(await request.json()),
      workspaceId,
    });
    const { supabase, user } = await requireMembership(workspaceId, ["owner", "editor"]);

    // Suggest attachment instead of duplicating when similar open task exists.
    if (body.aspectId || body.title) {
      const { data: existing } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("workspace_id", workspaceId)
        .eq("aspect_key", body.aspectId ?? "")
        .neq("status", "closed")
        .limit(1)
        .maybeSingle();
      if (existing && body.evidenceFeedbackIds.length) {
        await supabase.from("task_evidence").upsert(
          body.evidenceFeedbackIds.map((feedbackId) => ({
            workspace_id: workspaceId,
            task_id: existing.id,
            feedback_id: feedbackId,
          })),
          { onConflict: "task_id,feedback_id" },
        );
        return NextResponse.json({
          task: existing,
          attached: true,
          message: "Attached evidence to an existing open task instead of duplicating.",
        });
      }
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        workspace_id: workspaceId,
        entity_id: body.entityId,
        aspect_key: body.aspectId,
        title: body.title,
        description: body.description,
        priority: body.priority,
        effort: body.effort,
        due_date: body.dueDate,
        recurring: body.recurring,
        owner_user_id: user.id,
        status: "needs_attention",
      })
      .select("*")
      .single();
    if (error || !task) {
      return NextResponse.json({ error: error?.message ?? "Task failed" }, { status: 500 });
    }

    if (body.evidenceFeedbackIds.length) {
      await supabase.from("task_evidence").insert(
        body.evidenceFeedbackIds.map((feedbackId) => ({
          workspace_id: workspaceId,
          task_id: task.id,
          feedback_id: feedbackId,
        })),
      );
    }

    await supabase.from("audit_events").insert({
      workspace_id: workspaceId,
      actor_user_id: user.id,
      action: "task.created",
      target_type: "task",
      target_id: task.id,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid task" },
      { status: 400 },
    );
  }
}
