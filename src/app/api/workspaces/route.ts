import { NextResponse } from "next/server";
import { OnboardingInputSchema } from "@/shared/schemas/onboarding";
import { requireUser } from "@/server/auth/permissions";
import { createWorkspaceWithDefaults } from "@/server/repositories/workspaces";
import { AuthError } from "@/server/auth/permissions";

export async function POST(request: Request) {
  try {
    const body = OnboardingInputSchema.parse(await request.json());
    const { supabase, user } = await requireUser();
    const workspace = await createWorkspaceWithDefaults(supabase, user.id, body);
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
