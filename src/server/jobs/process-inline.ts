import { createServiceClient } from "@/lib/supabase/server";
import { classifyFeedback } from "@/server/jev/classify";
import { jevConfigured } from "@/server/jev/client";
import {
  complaintShare,
  praiseShare,
  prevalence,
  compareComplaintShares,
  type AspectCounts,
} from "@/server/analysis/metrics";
import { CALCULATION_VERSION, COMPARISON_FORMULA_VERSION } from "@/shared/schemas/metrics";
import type { WorkspaceKind } from "@/shared/schemas/domain";
import { feedbackLimitForPlan } from "@/shared/plans";
import { CLASSIFICATION_SCHEMA_VERSION } from "@/server/jev/taxonomy";

/** Dev/fallback path when Inngest is not configured: classify + aggregate only. */
export async function processWorkspaceInline(workspaceId: string) {
  const service = createServiceClient();
  const { data: workspace } = await service
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .is("deleted_at", null)
    .single();
  if (!workspace) throw new Error("Workspace not found");

  const { data: taxonomy } = await service
    .from("taxonomy_versions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("active", true)
    .single();

  let classified = 0;
  let skipped = 0;

  if (!jevConfigured()) {
    return {
      classified: 0,
      skipped: 0,
      message: "TYPESAFE_API_KEY missing — classification skipped (no fabricated labels).",
    };
  }

  const perEntityLimit = feedbackLimitForPlan((workspace as { plan?: string }).plan);
  const { data: entityRows } = await service
    .from("workspace_entities")
    .select("entity_id")
    .eq("workspace_id", workspaceId);

  const pending: Array<{ id: string; original_text: string }> = [];
  for (const link of entityRows ?? []) {
    const { data: newest } = await service
      .from("feedback")
      .select("id, original_text")
      .eq("workspace_id", workspaceId)
      .eq("entity_id", link.entity_id)
      .eq("is_duplicate", false)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(perEntityLimit);
    pending.push(...(newest ?? []));
  }

  for (const fb of pending) {
    const { data: existing } = await service
      .from("classifications")
      .select("id")
      .eq("feedback_id", fb.id)
      .eq("schema_version", CLASSIFICATION_SCHEMA_VERSION)
      .maybeSingle();
    if (existing) continue;

    const result = await classifyFeedback({
      text: fb.original_text,
      kind: workspace.kind as WorkspaceKind,
      taxonomyVersionId: taxonomy?.id ?? "none",
    });
    if (result.status === "skipped") {
      skipped += 1;
      continue;
    }

    const { data: classification } = await service
      .from("classifications")
      .insert({
        workspace_id: workspaceId,
        feedback_id: fb.id,
        taxonomy_version_id: taxonomy?.id,
        model: result.model,
        schema_version: result.schemaVersion,
        status: result.status,
        is_praise: result.isPraise,
        is_complaint: result.isComplaint,
        is_request: result.isRequest,
        is_question: result.isQuestion,
        is_irrelevant: result.isIrrelevant,
        switching_intent: result.switchingIntent,
        severity: result.severity,
        aspects: result.aspects,
        probabilities: result.probabilities,
        cache_key: result.cacheKey,
      })
      .select("id")
      .single();

    if (classification && result.evidence.length) {
      await service.from("evidence_spans").insert(
        result.evidence.map((e) => ({
          workspace_id: workspaceId,
          classification_id: classification.id,
          feedback_id: fb.id,
          sentence_id: e.sentenceId,
          start_offset: e.start,
          end_offset: e.end,
          aspect_key: e.aspectKey,
          sentiment: e.sentiment,
          excerpt: e.excerpt,
        })),
      );
    }
    classified += 1;
  }

  const periodEnd = new Date();
  const period = {
    start: periodEnd.toISOString(),
    end: periodEnd.toISOString(),
    timezone: workspace.timezone ?? "UTC",
  };

  const { data: entityLinks } = await service
    .from("workspace_entities")
    .select("entity_id, role")
    .eq("workspace_id", workspaceId);

  for (const link of entityLinks ?? []) {
    const countsByAspect = await computeAspectCounts(
      service,
      workspaceId,
      link.entity_id,
      perEntityLimit,
    );
    const metrics: Record<string, unknown> = {};
    for (const [aspectKey, counts] of Object.entries(countsByAspect)) {
      metrics[aspectKey] = {
        prevalence: prevalence(counts, period),
        complaint_share: complaintShare(counts, period),
        praise_share: praiseShare(counts, period),
        shares_need_not_sum_to_100: true,
      };
    }
    await service
      .from("metric_snapshots")
      .update({ active: false })
      .eq("workspace_id", workspaceId)
      .eq("entity_id", link.entity_id)
      .eq("active", true);
    await service.from("metric_snapshots").insert({
      workspace_id: workspaceId,
      entity_id: link.entity_id,
      period_start: period.start,
      period_end: period.end,
      filters: {},
      coverage: {},
      metrics,
      formula_version: CALCULATION_VERSION,
      active: true,
    });
  }

  const primary = (entityLinks ?? []).find((e) => e.role === "primary");
  const competitors = (entityLinks ?? []).filter((e) => e.role === "competitor");
  const comparisons = [];
  if (primary) {
    const primaryCounts = await computeAspectCounts(
      service,
      workspaceId,
      primary.entity_id,
      perEntityLimit,
    );
    for (const competitor of competitors) {
      const competitorCounts = await computeAspectCounts(
        service,
        workspaceId,
        competitor.entity_id,
        perEntityLimit,
      );
      for (const aspectKey of new Set([
        ...Object.keys(primaryCounts),
        ...Object.keys(competitorCounts),
      ])) {
        comparisons.push(
          compareComplaintShares({
            entityAId: primary.entity_id,
            entityBId: competitor.entity_id,
            countsA: primaryCounts[aspectKey] ?? emptyCounts(),
            countsB: competitorCounts[aspectKey] ?? emptyCounts(),
            period,
            source: null,
            language: workspace.language ?? null,
            aspectId: null,
            thresholds: {
              minAspectMentions: workspace.comparison_min_mentions ?? 30,
              practicalDifference: Number(workspace.comparison_practical_diff ?? 0.05),
              posteriorProbability: Number(workspace.comparison_posterior_threshold ?? 0.95),
            },
          }),
        );
      }
    }
  }

  await service
    .from("comparison_snapshots")
    .update({ active: false })
    .eq("workspace_id", workspaceId)
    .eq("active", true);
  await service.from("comparison_snapshots").insert({
    workspace_id: workspaceId,
    period_start: period.start,
    period_end: period.end,
    filters: {},
    results: comparisons,
    formula_version: COMPARISON_FORMULA_VERSION,
    active: true,
  });

  return { classified, skipped, comparisons: comparisons.length };
}

function emptyCounts(): AspectCounts {
  return {
    n: 0,
    m: 0,
    c: 0,
    p: 0,
    evidenceIds: [],
    exclusions: { excluded: 0, uncertain: 0, duplicate: 0, undated: 0 },
  };
}

async function computeAspectCounts(
  service: ReturnType<typeof createServiceClient>,
  workspaceId: string,
  entityId: string,
  perEntityLimit: number,
): Promise<Record<string, AspectCounts>> {
  const { data: feedback } = await service
    .from("feedback")
    .select(
      "id, published_at, is_duplicate, classifications(schema_version, status, is_irrelevant, aspects)",
    )
    .eq("workspace_id", workspaceId)
    .eq("entity_id", entityId)
    .eq("is_duplicate", false)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(perEntityLimit);

  const byAspect: Record<string, AspectCounts> = {};
  let n = 0;
  const exclusions = { excluded: 0, uncertain: 0, duplicate: 0, undated: 0 };

  for (const fb of feedback ?? []) {
    if (!fb.published_at) exclusions.undated += 1;
    const list = Array.isArray(fb.classifications)
      ? fb.classifications
      : fb.classifications
        ? [fb.classifications]
        : [];
    const classification =
      list.find((row) => row.schema_version === CLASSIFICATION_SCHEMA_VERSION) ??
      list.find((row) => row.status && row.status !== "failed") ??
      null;
    if (!classification || classification.status === "failed") {
      exclusions.excluded += 1;
      continue;
    }
    if (classification.status === "uncertain") exclusions.uncertain += 1;
    if (classification.is_irrelevant) {
      exclusions.excluded += 1;
      continue;
    }
    n += 1;
    for (const aspect of (classification.aspects as Array<{
      key: string;
      sentiment: string;
      unmatched?: boolean;
    }>) ?? []) {
      if (aspect.unmatched || aspect.key === "none" || aspect.key === "uncertain") continue;
      if (!byAspect[aspect.key]) {
        byAspect[aspect.key] = {
          n: 0,
          m: 0,
          c: 0,
          p: 0,
          evidenceIds: [],
          exclusions: { ...exclusions },
        };
      }
      byAspect[aspect.key].m += 1;
      if (aspect.sentiment === "negative" || aspect.sentiment === "mixed") byAspect[aspect.key].c += 1;
      if (aspect.sentiment === "positive" || aspect.sentiment === "mixed") byAspect[aspect.key].p += 1;
      byAspect[aspect.key].evidenceIds.push(fb.id);
    }
  }
  for (const key of Object.keys(byAspect)) {
    byAspect[key].n = n;
    byAspect[key].exclusions = { ...exclusions };
  }
  return byAspect;
}
