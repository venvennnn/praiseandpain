import { NextResponse } from "next/server";
import { FeedbackListQuerySchema } from "@/shared/schemas/domain";
import { AuthError, requireMembership } from "@/server/auth/permissions";

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const url = new URL(request.url);
    const query = FeedbackListQuerySchema.parse({
      workspaceId,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      topicId: url.searchParams.get("topicId") ?? undefined,
      source: url.searchParams.get("source") ?? undefined,
      entityId: url.searchParams.get("entityId") ?? undefined,
      sentiment: url.searchParams.get("sentiment") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    const { supabase } = await requireMembership(workspaceId);

    let builder = supabase
      .from("feedback")
      .select(
        "id, original_text, published_at, source, rating, source_url, entity_id, author_name, classifications(id, status, is_praise, is_complaint, aspects, evidence_spans(id, excerpt, start_offset, end_offset, aspect_key, sentiment))",
        { count: "exact" },
      )
      .eq("workspace_id", workspaceId)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(query.limit);

    if (query.cursor) {
      builder = builder.lt("published_at", query.cursor);
    }
    if (query.q) {
      builder = builder.ilike("original_text", `%${query.q}%`);
    }
    if (query.source) builder = builder.eq("source", query.source);
    if (query.entityId) builder = builder.eq("entity_id", query.entityId);
    if (query.from) builder = builder.gte("published_at", query.from);
    if (query.to) builder = builder.lte("published_at", query.to);

    const { data, error, count } = await builder;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const nextCursor =
      data && data.length === query.limit
        ? data[data.length - 1]?.published_at ?? null
        : null;

    return NextResponse.json({
      items: data ?? [],
      count,
      nextCursor,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid query" },
      { status: 400 },
    );
  }
}
