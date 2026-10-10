import { NextResponse } from "next/server";
import { AuthError, requireMembership } from "@/server/auth/permissions";
import { formulaSafeCsvCell } from "@/lib/utils";

export async function GET(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const { supabase } = await requireMembership(workspaceId);
    const format = new URL(request.url).searchParams.get("format") ?? "csv";

    const { data: feedback } = await supabase
      .from("feedback")
      .select(
        "id, original_text, published_at, source, rating, source_url, classifications(is_praise, is_complaint, aspects)",
      )
      .eq("workspace_id", workspaceId)
      .order("published_at", { ascending: false })
      .limit(5000);

    if (format === "html") {
      const rows = (feedback ?? [])
        .map((f) => {
          const c = Array.isArray(f.classifications)
            ? f.classifications[0]
            : f.classifications;
          const text = escapeHtml(f.original_text);
          return `<tr><td>${escapeHtml(f.source)}</td><td>${f.published_at ?? ""}</td><td>${text}</td><td>${c?.is_praise ? "praise" : ""} ${c?.is_complaint ? "pain" : ""}</td></tr>`;
        })
        .join("\n");
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Praise & Pain export</title></head><body><h1>Feedback export</h1><table border="1"><thead><tr><th>Source</th><th>Published</th><th>Text</th><th>Labels</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="praise-pain-${workspaceId}.html"`,
        },
      });
    }

    const header = ["id", "source", "published_at", "rating", "text", "labels"].join(",");
    const lines = (feedback ?? []).map((f) => {
      const c = Array.isArray(f.classifications) ? f.classifications[0] : f.classifications;
      const labels = [
        c?.is_praise ? "praise" : null,
        c?.is_complaint ? "pain" : null,
      ]
        .filter(Boolean)
        .join("|");
      return [
        formulaSafeCsvCell(f.id),
        formulaSafeCsvCell(f.source),
        formulaSafeCsvCell(f.published_at),
        formulaSafeCsvCell(f.rating),
        formulaSafeCsvCell(f.original_text),
        formulaSafeCsvCell(labels),
      ].join(",");
    });
    const csv = [header, ...lines].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="praise-pain-${workspaceId}.csv"`,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Export failed" }, { status: 400 });
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
