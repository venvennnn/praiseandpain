import { NextResponse } from "next/server";
import { AuthError, requireMembership } from "@/server/auth/permissions";
import { feedbackLimitForPlan } from "@/shared/plans";
import { buildTrends, type TrendAspect, type TrendReview } from "@/server/analysis/trends";
import { rankThemes } from "@/server/analysis/report-themes";
import { CLASSIFICATION_SCHEMA_VERSION, aspectLabel } from "@/server/jev/taxonomy";
import { geminiConfigured, writeInsightBrief, type InsightFacts } from "@/server/gemini/brief";

export async function POST(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    if (!geminiConfigured()) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not set. The report already shows the calculated themes. Add the key only if you want Gemini to write the summary.",
        },
        { status: 503 },
      );
    }

    const { supabase } = await requireMembership(workspaceId);
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("name, timezone, plan")
      .eq("id", workspaceId)
      .maybeSingle();
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

    const { data: links } = await supabase
      .from("workspace_entities")
      .select("role, entity_id, entity:entities(id, name)")
      .eq("workspace_id", workspaceId);
    const primary = (links ?? []).find((link) => link.role === "primary");
    if (!primary) return NextResponse.json({ error: "Register your place first" }, { status: 404 });
    const entity = Array.isArray(primary.entity) ? primary.entity[0] : primary.entity;
    const placeName = (entity?.name as string) ?? workspace.name;

    const { data: snapshot } = await supabase
      .from("metric_snapshots")
      .select("metrics, coverage")
      .eq("workspace_id", workspaceId)
      .eq("entity_id", primary.entity_id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const metrics = (snapshot?.metrics ?? {}) as Record<
      string,
      {
        praise_share?: { value?: number | null; denominator?: number | null };
        complaint_share?: { value?: number | null; denominator?: number | null };
      }
    >;
    const coverage = snapshot?.coverage as {
      verdicts?: { praise?: number; pain?: number; mixed?: number; plain?: number };
    } | null;
    const verdicts = coverage?.verdicts;
    const praiseCount = verdicts?.praise ?? 0;
    const painCount = verdicts?.pain ?? 0;
    const plainCount = (verdicts?.mixed ?? 0) + (verdicts?.plain ?? 0);
    const classified = praiseCount + painCount + plainCount;

    const limit = feedbackLimitForPlan(workspace.plan);
    const { data: feedback } = await supabase
      .from("feedback")
      .select(
        "published_at, rating, classifications(schema_version, status, is_praise, is_complaint, is_irrelevant, aspects)",
      )
      .eq("workspace_id", workspaceId)
      .eq("entity_id", primary.entity_id)
      .eq("is_duplicate", false)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    const series = buildTrends((feedback ?? []).map(toTrendReview), {
      timeZone: workspace.timezone || "UTC",
      maxCategories: 8,
    });

    const facts: InsightFacts = {
      place: placeName,
      classifiedReviews: classified,
      praiseCount,
      painCount,
      plainCount,
      praiseRate: classified > 0 ? praiseCount / classified : null,
      painRate: classified > 0 ? painCount / classified : null,
      topPain: rankThemes(metrics, "pain", 5).map((theme) => ({
        name: theme.label,
        complaintShare: theme.share,
        mentions: theme.mentions,
      })),
      topPraise: rankThemes(metrics, "praise", 5).map((theme) => ({
        name: theme.label,
        praiseShare: theme.share,
        mentions: theme.mentions,
      })),
      praiseShiftPercentagePoints: series.praiseShift?.percentagePoints ?? null,
      painShiftPercentagePoints: series.painShift?.percentagePoints ?? null,
      praiseShiftWindow: series.praiseShift
        ? `${series.praiseShift.earlierLabel} to ${series.praiseShift.laterLabel}`
        : null,
      painShiftWindow: series.painShift
        ? `${series.painShift.earlierLabel} to ${series.painShift.laterLabel}`
        : null,
      categoryPainMoves: series.categoryMovers.slice(0, 4).map((mover) => ({
        name: aspectLabel(mover.key),
        percentagePoints: mover.percentagePoints,
        from: mover.earlierLabel,
        to: mover.laterLabel,
      })),
    };

    const brief = await writeInsightBrief(facts);
    return NextResponse.json({ brief, source: "gemini" });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not write the summary" },
      { status: 400 },
    );
  }
}

function toTrendReview(row: {
  published_at: string | null;
  rating: number | null;
  classifications:
    | {
        schema_version?: string;
        status?: string | null;
        is_praise?: boolean | null;
        is_complaint?: boolean | null;
        is_irrelevant?: boolean | null;
        aspects?: TrendAspect[] | null;
      }
    | Array<{
        schema_version?: string;
        status?: string | null;
        is_praise?: boolean | null;
        is_complaint?: boolean | null;
        is_irrelevant?: boolean | null;
        aspects?: TrendAspect[] | null;
      }>
    | null;
}): TrendReview {
  const list = Array.isArray(row.classifications)
    ? row.classifications
    : row.classifications
      ? [row.classifications]
      : [];
  const classification =
    list.find((item) => item.schema_version === CLASSIFICATION_SCHEMA_VERSION) ??
    list.find((item) => item.status && item.status !== "failed") ??
    null;
  return {
    publishedAt: row.published_at,
    rating: row.rating,
    status: classification?.status ?? null,
    isPraise: classification?.is_praise ?? null,
    isComplaint: classification?.is_complaint ?? null,
    irrelevant: Boolean(classification?.is_irrelevant),
    aspects: classification?.aspects ?? [],
  };
}
