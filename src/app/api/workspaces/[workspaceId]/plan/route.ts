import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireMembership } from "@/server/auth/permissions";
import { feedbackLimitForPlan } from "@/shared/plans";

const Body = z.object({
  plan: z.enum(["base", "pro"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const { plan } = Body.parse(await request.json());
    const { supabase, user } = await requireMembership(workspaceId, ["owner"]);
    const limit = feedbackLimitForPlan(plan);

    const { error } = await supabase
      .from("workspaces")
      .update({
        plan,
        retrieval_budget: limit,
      })
      .eq("id", workspaceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("audit_events").insert({
      workspace_id: workspaceId,
      actor_user_id: user.id,
      action: "workspace.plan_changed",
      metadata: { plan, perEntityLimit: limit },
    });

    return NextResponse.json({
      plan,
      perEntityLimit: limit,
      note: "Billing is not connected yet. This changes the review cap only.",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not change plan" },
      { status: 400 },
    );
  }
}
