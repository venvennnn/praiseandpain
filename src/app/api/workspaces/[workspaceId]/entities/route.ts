import { NextResponse } from "next/server";
import { RegisterEntitySchema } from "@/shared/schemas/domain";
import { AuthError, requireMembership } from "@/server/auth/permissions";

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const body = RegisterEntitySchema.parse({
      ...(await request.json()),
      workspaceId,
    });
    const { supabase, user } = await requireMembership(workspaceId, ["owner", "editor"]);

    const { count } = await supabase
      .from("workspace_entities")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("role", "competitor");

    if (body.role === "competitor" && (count ?? 0) >= 3) {
      return NextResponse.json(
        { error: "Maximum of three competitors per workspace" },
        { status: 400 },
      );
    }

    const { data: entity, error } = await supabase
      .from("entities")
      .upsert(
        {
          source: body.source,
          provider_id: body.providerId,
          name: body.name,
          kind: body.kind,
          url: body.url,
          metadata: body.metadata,
        },
        { onConflict: "source,provider_id" },
      )
      .select("*")
      .single();
    if (error || !entity) {
      return NextResponse.json({ error: error?.message ?? "Entity failed" }, { status: 500 });
    }

    const { error: linkError } = await supabase.from("workspace_entities").upsert(
      {
        workspace_id: workspaceId,
        entity_id: entity.id,
        role: body.role,
      },
      { onConflict: "workspace_id,entity_id" },
    );
    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    await supabase.from("source_connections").upsert(
      {
        workspace_id: workspaceId,
        entity_id: entity.id,
        source: body.source,
        config: body.metadata,
      },
      { onConflict: "workspace_id,entity_id,source" },
    );

    await supabase.from("audit_events").insert({
      workspace_id: workspaceId,
      actor_user_id: user.id,
      action: "entity.registered",
      target_type: "entity",
      target_id: entity.id,
      metadata: { role: body.role },
    });

    return NextResponse.json({ entity }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid entity" },
      { status: 400 },
    );
  }
}
