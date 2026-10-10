import { NextResponse } from "next/server";
import { AuthError, requireMembership } from "@/server/auth/permissions";
import { processWorkspaceInline } from "@/server/jobs/process-inline";

export async function POST(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireMembership(workspaceId, ["owner", "editor"]);
    const result = await processWorkspaceInline(workspaceId);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Process failed" },
      { status: 400 },
    );
  }
}
