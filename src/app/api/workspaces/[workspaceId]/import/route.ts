import { NextResponse } from "next/server";
import Papa from "papaparse";
import { z } from "zod";
import { AuthError, requireMembership } from "@/server/auth/permissions";
import { ImportMappingSchema } from "@/shared/schemas/domain";
import { parseFeedbackDate } from "@/server/analysis/dates";
import { contentHash } from "@/server/analysis/text";

const ImportBodySchema = z.object({
  entityId: z.string().uuid(),
  format: z.enum(["csv", "json"]),
  mapping: ImportMappingSchema,
  content: z.string().max(2_000_000),
  dryRun: z.boolean().default(false),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const { supabase, user } = await requireMembership(workspaceId, ["owner", "editor"]);
    const body = ImportBodySchema.parse(await request.json());

    if (Buffer.byteLength(body.content, "utf8") > 2_000_000) {
      return NextResponse.json({ error: "Import exceeds 2MB size limit" }, { status: 400 });
    }

    const { data: link } = await supabase
      .from("workspace_entities")
      .select("entity_id")
      .eq("workspace_id", workspaceId)
      .eq("entity_id", body.entityId)
      .maybeSingle();
    if (!link) {
      return NextResponse.json({ error: "Entity not in workspace" }, { status: 403 });
    }

    type Row = Record<string, string>;
    let rows: Row[] = [];
    if (body.format === "csv") {
      const parsed = Papa.parse<Row>(body.content, {
        header: true,
        skipEmptyLines: true,
      });
      if (parsed.errors.length) {
        return NextResponse.json(
          { error: "CSV parse error", details: parsed.errors.slice(0, 5) },
          { status: 400 },
        );
      }
      rows = parsed.data;
    } else {
      const json = JSON.parse(body.content) as unknown;
      if (!Array.isArray(json)) {
        return NextResponse.json({ error: "JSON must be an array of objects" }, { status: 400 });
      }
      rows = json.map((item) => {
        const obj = item as Record<string, unknown>;
        const out: Row = {};
        for (const [k, v] of Object.entries(obj)) out[k] = String(v ?? "");
        return out;
      });
    }

    if (rows.length > 5000) {
      return NextResponse.json({ error: "Maximum 5000 rows per import" }, { status: 400 });
    }

    const preview = rows.slice(0, 5).map((row, index) => {
      const text = row[body.mapping.text] ?? "";
      return {
        index,
        text,
        providerId: body.mapping.providerId ? row[body.mapping.providerId] : `import-${index}`,
        publishedAt: body.mapping.publishedAt ? row[body.mapping.publishedAt] : null,
        rating: body.mapping.rating ? row[body.mapping.rating] : null,
      };
    });

    const invalid = rows.filter((r) => !(r[body.mapping.text] ?? "").trim()).length;
    if (body.dryRun) {
      return NextResponse.json({
        preview,
        total: rows.length,
        invalid,
        mapping: body.mapping,
      });
    }

    if (invalid === rows.length) {
      return NextResponse.json({ error: "No valid text rows" }, { status: 400 });
    }

    let inserted = 0;
    let duplicates = 0;
    const source = body.format === "csv" ? "csv_import" : "json_import";

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const text = (row[body.mapping.text] ?? "").trim();
      if (!text) continue;
      const providerId = body.mapping.providerId
        ? row[body.mapping.providerId] || `import-${contentHash(text).slice(0, 16)}`
        : `import-${contentHash(text).slice(0, 16)}`;
      const dateRaw = body.mapping.publishedAt ? row[body.mapping.publishedAt] : null;
      const parsed = parseFeedbackDate(dateRaw);
      const ratingRaw = body.mapping.rating ? row[body.mapping.rating] : null;
      const rating = ratingRaw ? Number(ratingRaw) : null;

      const { error, data } = await supabase
        .from("feedback")
        .upsert(
          {
            workspace_id: workspaceId,
            entity_id: body.entityId,
            source,
            provider_id: providerId,
            original_text: text,
            original_date_string: dateRaw,
            published_at: parsed.publishedAt,
            date_precision: parsed.precision,
            retrieved_at: new Date().toISOString(),
            language: body.mapping.language ? row[body.mapping.language] || null : null,
            rating: Number.isFinite(rating) ? rating : null,
            source_url: body.mapping.sourceUrl ? row[body.mapping.sourceUrl] || null : null,
            content_hash: contentHash(text),
            author_name: body.mapping.author ? row[body.mapping.author] || null : null,
            crosses_boundary_risk: parsed.crossesBoundaryRisk,
          },
          { onConflict: "workspace_id,source,provider_id" },
        )
        .select("id")
        .single();

      if (error) {
        if (/duplicate|unique/i.test(error.message)) duplicates += 1;
        continue;
      }
      if (data) inserted += 1;
    }

    await supabase.from("audit_events").insert({
      workspace_id: workspaceId,
      actor_user_id: user.id,
      action: "feedback.imported",
      metadata: {
        format: body.format,
        inserted,
        duplicates,
        invalid,
        provenance: "user_upload",
      },
    });

    return NextResponse.json({
      inserted,
      duplicates,
      invalid,
      total: rows.length,
      provenance: "user_upload",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 400 },
    );
  }
}
