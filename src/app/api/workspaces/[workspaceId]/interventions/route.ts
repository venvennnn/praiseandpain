import { NextResponse } from "next/server";
import { addDays, subDays } from "date-fns";
import { CreateInterventionSchema } from "@/shared/schemas/domain";
import { AuthError, requireMembership } from "@/server/auth/permissions";
import { complaintShare, type AspectCounts } from "@/server/analysis/metrics";

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await context.params;
    const body = CreateInterventionSchema.parse({
      ...(await request.json()),
      workspaceId,
    });
    const { supabase, user } = await requireMembership(workspaceId, ["owner", "editor"]);

    const implementedAt = new Date(body.implementedAt);
    const beforeEnd = subDays(implementedAt, 1);
    const beforeStart = subDays(beforeEnd, body.windowDays - 1);
    const afterStart = addDays(implementedAt, body.washoutDays);
    const afterEnd = addDays(afterStart, body.windowDays - 1);
    const followUpComplete = afterEnd <= new Date();

    const { data: overlapping } = await supabase
      .from("interventions")
      .select("id, description, implemented_at")
      .eq("workspace_id", workspaceId)
      .eq("entity_id", body.entityId)
      .gte("implemented_at", subDays(implementedAt, body.windowDays).toISOString())
      .lte("implemented_at", addDays(implementedAt, body.windowDays).toISOString());

    async function windowCounts(start: Date, end: Date): Promise<AspectCounts> {
      const { data } = await supabase
        .from("feedback")
        .select("id, classifications(status, aspects, is_irrelevant)")
        .eq("workspace_id", workspaceId)
        .eq("entity_id", body.entityId)
        .gte("published_at", start.toISOString())
        .lte("published_at", end.toISOString())
        .eq("is_duplicate", false);

      const counts: AspectCounts = {
        n: 0,
        m: 0,
        c: 0,
        p: 0,
        evidenceIds: [],
        exclusions: { excluded: 0, uncertain: 0, duplicate: 0, undated: 0 },
      };
      for (const fb of data ?? []) {
        const c = Array.isArray(fb.classifications)
          ? fb.classifications[0]
          : fb.classifications;
        if (!c || c.status === "failed" || c.is_irrelevant) {
          counts.exclusions.excluded += 1;
          continue;
        }
        counts.n += 1;
        const aspects = (c.aspects as Array<{ key: string; sentiment: string }>) ?? [];
        for (const a of aspects) {
          if (!body.aspectIds.includes(a.key) && !body.aspectIds.length) continue;
          // aspectIds are topic UUIDs in schema; also accept keys from client
          if (
            body.aspectIds.length &&
            !body.aspectIds.includes(a.key as never) &&
            !body.aspectIds.some((id) => id === a.key)
          ) {
            // Also match when clients send aspect keys in aspectIds field via casting
          }
          const keys = body.aspectIds as unknown as string[];
          if (keys.length && !keys.includes(a.key)) continue;
          counts.m += 1;
          if (a.sentiment === "negative" || a.sentiment === "mixed") counts.c += 1;
          if (a.sentiment === "positive" || a.sentiment === "mixed") counts.p += 1;
          counts.evidenceIds.push(fb.id);
        }
      }
      return counts;
    }

    const beforeCounts = await windowCounts(beforeStart, beforeEnd);
    const afterCounts = followUpComplete
      ? await windowCounts(afterStart, afterEnd)
      : null;

    const periodBefore = {
      start: beforeStart.toISOString(),
      end: beforeEnd.toISOString(),
      timezone: "UTC",
    };
    const beforeMetric = complaintShare(beforeCounts, periodBefore);
    const afterMetric = afterCounts
      ? complaintShare(afterCounts, {
          start: afterStart.toISOString(),
          end: afterEnd.toISOString(),
          timezone: "UTC",
        })
      : null;

    let outcome: string = "pending";
    let observedChange: number | null = null;
    if (!followUpComplete) {
      outcome = "pending";
    } else if (
      !afterMetric ||
      afterMetric.value === null ||
      beforeMetric.value === null ||
      (beforeCounts.m < 10 && afterCounts!.m < 10)
    ) {
      outcome = "insufficient_data";
    } else {
      observedChange = afterMetric.value - beforeMetric.value;
      if (observedChange <= -0.05) outcome = "improvement_observed";
      else if (observedChange >= 0.05) outcome = "deterioration_observed";
      else outcome = "no_clear_change";
    }

    const result = {
      before: beforeMetric,
      after: afterMetric,
      observedPercentagePointChange: observedChange,
      overlapping: overlapping ?? [],
      disclaimer:
        "Rates compared with the same classification filters. This does not establish causation.",
      followUpComplete,
    };

    const { data: intervention, error } = await supabase
      .from("interventions")
      .insert({
        workspace_id: workspaceId,
        entity_id: body.entityId,
        description: body.description,
        aspect_keys: body.aspectIds,
        implemented_at: body.implementedAt,
        washout_days: body.washoutDays,
        window_days: body.windowDays,
        outcome,
        result,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ intervention }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid intervention" },
      { status: 400 },
    );
  }
}
