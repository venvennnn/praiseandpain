import { NextResponse } from "next/server";
import { AuthError, requireMembership } from "@/server/auth/permissions";
import { processWorkspaceInline } from "@/server/jobs/process-inline";
import {
  assertJevConfigured,
  MissingRequiredConfigError,
} from "@/server/config/requirements";

export async function POST(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    await requireMembership(workspaceId, ["owner", "editor"]);
    assertJevConfigured();
    const result = await processWorkspaceInline(workspaceId);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof MissingRequiredConfigError) {
      return NextResponse.json(
        { error: err.message, missing: err.missing, required: true },
        { status: 503 },
      );
    }
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Process failed" },
      { status: 400 },
    );
  }
}
