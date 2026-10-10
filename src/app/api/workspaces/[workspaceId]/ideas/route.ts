import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireMembership } from "@/server/auth/permissions";

const IdeaSchema = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(5000).optional(),
  sourceFeedbackIds: z.array(z.string().uuid()).default([]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const body = IdeaSchema.parse(await request.json());
    const { supabase, user } = await requireMembership(workspaceId, ["owner", "editor"]);

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("kind")
      .eq("id", workspaceId)
      .single();
    if (workspace?.kind !== "creator") {
      return NextResponse.json(
        { error: "Creator backlog is only for creator workspaces" },
        { status: 400 },
      );
    }

    const { data: idea, error } = await supabase
      .from("content_ideas")
      .insert({
        workspace_id: workspaceId,
        title: body.title,
        notes: body.notes,
        source_feedback_ids: body.sourceFeedbackIds,
        status: "considering",
      })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("audit_events").insert({
      workspace_id: workspaceId,
      actor_user_id: user.id,
      action: "idea.created",
      target_type: "content_idea",
      target_id: idea.id,
    });

    return NextResponse.json({ idea }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid idea" },
      { status: 400 },
    );
  }
}
