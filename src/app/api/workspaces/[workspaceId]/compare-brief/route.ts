import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireMembership } from "@/server/auth/permissions";
import { buildHeadToHead, profileFromSnapshot } from "@/server/analysis/head-to-head";
import { aspectLabel } from "@/server/jev/taxonomy";
import { geminiConfigured, writeComparisonBrief } from "@/server/gemini/brief";

const Body = z.object({
  competitorId: z.string().uuid(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const { competitorId } = Body.parse(await request.json());
    if (!geminiConfigured()) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not set. The comparison on the page is already calculated from your reviews. Add the key only if you want Gemini to rewrite that brief.",
        },
        { status: 503 },
      );
    }

    const { supabase } = await requireMembership(workspaceId);
    const { data: links } = await supabase
      .from("workspace_entities")
      .select("role, entity_id, entity:entities(id, name)")
      .eq("workspace_id", workspaceId);

    const places = (links ?? []).map((link) => {
      const entity = Array.isArray(link.entity) ? link.entity[0] : link.entity;
      return {
        id: link.entity_id as string,
        name: (entity?.name as string) ?? "Place",
        role: link.role as string,
      };
    });
    const primary = places.find((place) => place.role === "primary");
    const competitor = places.find((place) => place.id === competitorId && place.role === "competitor");
    if (!primary || !competitor) {
      return NextResponse.json({ error: "That competitor is not in this workspace" }, { status: 404 });
    }

    const { data: snapshots } = await supabase
      .from("metric_snapshots")
      .select("entity_id, metrics, coverage")
      .eq("workspace_id", workspaceId)
      .eq("active", true);

    const snap = (id: string) => (snapshots ?? []).find((row) => row.entity_id === id);
    const ours = profileFromSnapshot({
      id: primary.id,
      name: primary.name,
      metrics: snap(primary.id)?.metrics as never,
      coverage: snap(primary.id)?.coverage as never,
    });
    const theirs = profileFromSnapshot({
      id: competitor.id,
      name: competitor.name,
      metrics: snap(competitor.id)?.metrics as never,
      coverage: snap(competitor.id)?.coverage as never,
    });
    const labels: Record<string, string> = {};
    for (const theme of [...ours.themes, ...theirs.themes]) labels[theme.key] = aspectLabel(theme.key);
    const head = buildHeadToHead(ours, theirs, labels);
    const brief = await writeComparisonBrief({ ourName: primary.name, head, themeLabels: labels });
    return NextResponse.json({ brief, source: "gemini" });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not write the brief" },
      { status: 400 },
    );
  }
}
