import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SyncRequestSchema } from "@/shared/schemas/domain";
import { AuthError, requireMembership } from "@/server/auth/permissions";
import { inngest, events } from "@/server/jobs/inngest";
import { nanoid } from "nanoid";
import {
  assertCollectionStackConfigured,
  MissingRequiredConfigError,
} from "@/server/config/requirements";

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    assertCollectionStackConfigured();

    const json = await request.json().catch(() => ({}));
    const body = SyncRequestSchema.parse({
      workspaceId,
      entityIds: Array.isArray(json.entityIds) ? json.entityIds : [],
      forceFull: json.forceFull,
    });

    const { supabase, user } = await requireMembership(workspaceId, [
      "owner",
      "editor",
    ]);

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("paused, deleted_at")
      .eq("id", workspaceId)
      .single();
    if (!workspace || workspace.deleted_at) {
      return NextResponse.json({ error: "Workspace unavailable" }, { status: 404 });
    }
    if (workspace.paused) {
      return NextResponse.json({ error: "Workspace is paused" }, { status: 409 });
    }

    let entityIds = body.entityIds;
    if (!entityIds?.length) {
      const { data: links } = await supabase
        .from("workspace_entities")
        .select("entity_id")
        .eq("workspace_id", workspaceId);
      entityIds = (links ?? []).map((l) => l.entity_id);
    }
    if (!entityIds.length) {
      return NextResponse.json(
        { error: "Register an entity before syncing" },
        { status: 400 },
      );
    }

    const idempotencyKey = `sync:${workspaceId}:${entityIds.sort().join(",")}:${body.forceFull}:${new Date().toISOString().slice(0, 13)}`;

    const { data: existing } = await supabase
      .from("collection_runs")
      .select("id, status")
      .eq("workspace_id", workspaceId)
      .in("status", ["queued", "running"])
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { runId: existing.id, status: existing.status, message: "Run already in progress" },
        { status: 202 },
      );
    }

    const { data: run, error } = await supabase
      .from("collection_runs")
      .insert({
        workspace_id: workspaceId,
        status: "queued",
        stage: "discover",
        idempotency_key: idempotencyKey + ":" + nanoid(6),
        entity_ids: entityIds,
        force_full: body.forceFull,
        progress: { requestedBy: user.id },
      })
      .select("id")
      .single();

    if (error || !run) {
      return NextResponse.json({ error: error?.message ?? "Could not queue run" }, { status: 500 });
    }

    await inngest.send({
      name: events.syncRequested,
      data: { workspaceId, runId: run.id },
    });

    return NextResponse.json({ runId: run.id, status: "queued" }, { status: 202 });
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
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : "Invalid sync request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
