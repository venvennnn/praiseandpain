import { createServiceClient } from "@/lib/supabase/server";
import { assertRunOwnership } from "@/server/auth/permissions";
import { getConnector, serpApiConfigured } from "@/server/connectors";
import { ConnectorConfigError } from "@/server/connectors/serpapi";
import { parseFeedbackDate, isEligibleForPeriodComparison } from "@/server/analysis/dates";
import { contentHash } from "@/server/analysis/text";
import { classifyFeedback } from "@/server/jev/classify";
import {
  complaintShare,
  praiseShare,
  prevalence,
  compareComplaintShares,
  type AspectCounts,
} from "@/server/analysis/metrics";
import { CALCULATION_VERSION, COMPARISON_FORMULA_VERSION } from "@/shared/schemas/metrics";
import type { SourceType, WorkspaceKind } from "@/shared/schemas/domain";
import { inngest, events } from "./inngest";
import { subDays } from "date-fns";

async function updateRun(
  runId: string,
  patch: Record<string, unknown>,
) {
  const service = createServiceClient();
  await service.from("collection_runs").update(patch).eq("id", runId);
}

async function checkpointStep(
  workspaceId: string,
  runId: string,
  stage: string,
  key: string,
  checkpoint: Record<string, unknown>,
  status: "running" | "completed" | "failed" = "completed",
) {
  const service = createServiceClient();
  await service.from("run_steps").upsert(
    {
      workspace_id: workspaceId,
      run_id: runId,
      stage,
      idempotency_key: key,
      status,
      checkpoint,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      started_at: new Date().toISOString(),
    },
    { onConflict: "run_id,idempotency_key" },
  );
}

export const syncPipeline = inngest.createFunction(
  {
    id: "feedback-sync-pipeline",
    retries: 2,
    concurrency: [{ key: "event.data.workspaceId", limit: 1 }],
  },
  { event: events.syncRequested },
  async ({ event, step }) => {
    const { workspaceId, runId } = event.data as {
      workspaceId: string;
      runId: string;
    };

    await step.run("validate-ownership", async () => {
      await assertRunOwnership(runId, workspaceId);
    });

    const service = createServiceClient();

    const workspace = await step.run("load-workspace", async () => {
      const { data, error } = await service
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .is("deleted_at", null)
        .single();
      if (error || !data) throw new Error("Workspace missing");
      if (data.paused) throw new Error("Workspace paused");
      return data;
    });

    await step.run("mark-running", async () => {
      await updateRun(runId, {
        status: "running",
        stage: "collect",
        started_at: new Date().toISOString(),
      });
    });

    const entities = await step.run("load-entities", async () => {
      const { data: run } = await service
        .from("collection_runs")
        .select("entity_ids, force_full")
        .eq("id", runId)
        .single();
      const { data } = await service
        .from("entities")
        .select("*, source_connections!inner(id, cursor, source, workspace_id)")
        .in("id", run?.entity_ids ?? [])
        .eq("source_connections.workspace_id", workspaceId);
      return { entities: data ?? [], forceFull: Boolean(run?.force_full) };
    });

    const collected = await step.run("collect", async () => {
      let collectedCount = 0;
      const failures: Array<{ entityId: string; error: string }> = [];

      if (!serpApiConfigured()) {
        const message =
          "SERPAPI_API_KEY is required for collection. Sync aborted — no fabricated feedback.";
        await checkpointStep(workspaceId, runId, "collect", "collect:fail-no-serpapi", {
          reason: message,
        }, "failed");
        await updateRun(runId, {
          status: "failed",
          stage: "collect",
          error: message,
          completed_at: new Date().toISOString(),
        });
        throw new Error(message);
      }

      for (const entity of entities.entities) {
        try {
          const source = entity.source as SourceType;
          if (source === "csv_import" || source === "json_import") continue;
          const connector = getConnector(source);
          const connection = Array.isArray(entity.source_connections)
            ? entity.source_connections[0]
            : entity.source_connections;

          let cursor = entities.forceFull ? null : connection?.cursor ?? null;
          let pages = 0;
          const pageBudget = Math.min(20, Math.ceil((workspace.retrieval_budget ?? 200) / 10));

          // Budget reservation
          const { data: ws } = await service
            .from("workspaces")
            .select("usage_consumed, usage_limit, retrieval_budget")
            .eq("id", workspaceId)
            .single();
          if (!ws || ws.usage_consumed >= ws.usage_limit) {
            failures.push({ entityId: entity.id, error: "Usage limit reached" });
            continue;
          }

          while (pages < pageBudget) {
            const remaining = ws.usage_limit - ws.usage_consumed;
            if (remaining <= 0) break;

            const page = await connector.fetchFeedbackPage(entity.provider_id, cursor, {
              budgetRemaining: remaining,
            });

            await service.from("provider_calls").insert({
              workspace_id: workspaceId,
              run_id: runId,
              provider: "serpapi",
              operation: `${source}.fetchFeedbackPage`,
              estimated_cost: page.quota.estimatedCost,
              confirmed_usage: page.quota.confirmedUsage,
              cache_hit: page.quota.cacheHits > 0,
              success: true,
            });

            await service
              .from("workspaces")
              .update({ usage_consumed: ws.usage_consumed + page.quota.requestsUsed })
              .eq("id", workspaceId);
            ws.usage_consumed += page.quota.requestsUsed;

            for (const record of page.records) {
              const parsed = parseFeedbackDate(record.originalDateString);
              const hash = contentHash(record.text);
              const { error } = await service.from("feedback").upsert(
                {
                  workspace_id: workspaceId,
                  entity_id: entity.id,
                  source,
                  provider_id: record.providerId,
                  original_text: record.text,
                  original_date_string: record.originalDateString,
                  published_at: parsed.publishedAt,
                  date_precision: parsed.precision,
                  retrieved_at: new Date().toISOString(),
                  language: record.language,
                  rating: record.rating,
                  source_url: record.sourceUrl,
                  content_hash: hash,
                  author_name: record.authorName,
                  crosses_boundary_risk: parsed.crossesBoundaryRisk,
                },
                { onConflict: "workspace_id,source,provider_id" },
              );
              if (!error) collectedCount += 1;
            }

            cursor = page.cursor;
            pages += 1;
            await checkpointStep(
              workspaceId,
              runId,
              "collect",
              `collect:${entity.id}:page:${pages}`,
              { cursor, collectedCount, coverage: page.coverage },
            );
            if (!page.hasMore) break;
          }

          if (connection?.id) {
            await service
              .from("source_connections")
              .update({ cursor, last_synced_at: new Date().toISOString() })
              .eq("id", connection.id);
          }
        } catch (err) {
          const message =
            err instanceof ConnectorConfigError
              ? err.message
              : err instanceof Error
                ? err.message
                : "collect failed";
          failures.push({ entityId: entity.id, error: message });
          if (err instanceof ConnectorConfigError) break;
        }
      }

      await updateRun(runId, {
        stage: "classify",
        progress: { collectedCount, failures },
      });
      return { collectedCount, failures };
    });

    // Classify in small Inngest steps so hundreds of Jev calls cannot timeout one step.
    const CLASSIFY_BATCH = 12;
    const CLASSIFY_CONCURRENCY = 4;
    const MAX_CLASSIFY_BATCHES = 100;
    let classifiedTotal = 0;

    for (let batchIndex = 0; batchIndex < MAX_CLASSIFY_BATCHES; batchIndex++) {
      const batch = await step.run(`classify-batch-${batchIndex}`, async () => {
        const svc = createServiceClient();
        const { data: taxonomy } = await svc
          .from("taxonomy_versions")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("active", true)
          .single();

        const { data: already } = await svc
          .from("classifications")
          .select("feedback_id")
          .eq("workspace_id", workspaceId)
          .limit(5000);
        const classifiedSet = new Set((already ?? []).map((row) => row.feedback_id));

        const { data: rows } = await svc
          .from("feedback")
          .select("id, original_text")
          .eq("workspace_id", workspaceId)
          .eq("is_duplicate", false)
          .order("created_at", { ascending: true })
          .limit(2000);

        const unclassified = (rows ?? []).filter((row) => !classifiedSet.has(row.id));
        const pending = unclassified.slice(0, CLASSIFY_BATCH);

        if (!pending.length) {
          return { classified: 0, done: true, remaining: 0 };
        }

        let classified = 0;
        let failed = 0;

        for (let i = 0; i < pending.length; i += CLASSIFY_CONCURRENCY) {
          const chunk = pending.slice(i, i + CLASSIFY_CONCURRENCY);
          const results = await Promise.all(
            chunk.map(async (fb) => {
              const result = await classifyFeedback({
                text: fb.original_text,
                kind: workspace.kind as WorkspaceKind,
                taxonomyVersionId: taxonomy?.id ?? "none",
                cached: null,
              });

              if (result.status === "skipped") {
                throw new Error(
                  "TYPESAFE_API_KEY is required for classification. Pipeline aborted — no invented labels.",
                );
              }

              const { data: classification, error } = await svc
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

              if (error || !classification) {
                // Unique conflict = already classified in a parallel/retry path.
                if (error && /duplicate|unique/i.test(error.message)) {
                  return { ok: true as const };
                }
                return { ok: false as const };
              }

              if (result.evidence.length) {
                await svc.from("evidence_spans").insert(
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

              await svc.from("classification_cache").upsert({
                cache_key: result.cacheKey,
                workspace_id: workspaceId,
                result,
              });

              return { ok: true as const };
            }),
          );

          for (const r of results) {
            if (r.ok) classified += 1;
            else failed += 1;
          }
        }

        const remaining = Math.max(0, unclassified.length - classified);
        await updateRun(runId, {
          stage: "classify",
          progress: {
            ...collected,
            classifiedSoFar: classifiedSet.size + classified,
            classifiedBatch: batchIndex,
            classifiedInBatch: classified,
            failedInBatch: failed,
            remaining,
          },
        });

        await checkpointStep(workspaceId, runId, "classify", `classify:batch:${batchIndex}`, {
          classified,
          failed,
          remaining,
        });

        return {
          classified,
          done: remaining === 0,
          remaining,
        };
      });

      classifiedTotal += batch.classified;
      if (batch.done) break;
    }

    await step.run("classify-finalize", async () => {
      await updateRun(runId, {
        stage: "aggregate",
        progress: { ...collected, classified: classifiedTotal },
      });
      return { classified: classifiedTotal };
    });

    await step.run("aggregate-compare", async () => {
      const periodEnd = new Date();
      const periodStart = subDays(periodEnd, workspace.analysis_window_days ?? 90);
      const period = {
        start: periodStart.toISOString(),
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
          periodStart,
          periodEnd,
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

        // Atomic publish: insert new active, deactivate previous in transaction-like sequence
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
          filters: { source: null },
          coverage: { note: "publication_dates_only" },
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
          periodStart,
          periodEnd,
        );
        for (const competitor of competitors) {
          const competitorCounts = await computeAspectCounts(
            service,
            workspaceId,
            competitor.entity_id,
            periodStart,
            periodEnd,
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
                  posteriorProbability: Number(
                    workspace.comparison_posterior_threshold ?? 0.95,
                  ),
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

      await updateRun(runId, {
        status: "completed",
        stage: "summarise",
        completed_at: new Date().toISOString(),
        progress: { ...collected, comparisons: comparisons.length },
      });
    });

    return { ok: true, runId };
  },
);

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
  periodStart: Date,
  periodEnd: Date,
): Promise<Record<string, AspectCounts>> {
  const { data: feedback } = await service
    .from("feedback")
    .select(
      "id, published_at, date_precision, crosses_boundary_risk, is_duplicate, classifications(status, is_irrelevant, aspects, evidence_spans(id))",
    )
    .eq("workspace_id", workspaceId)
    .eq("entity_id", entityId);

  const byAspect: Record<string, AspectCounts> = {};
  let n = 0;
  const exclusions = { excluded: 0, uncertain: 0, duplicate: 0, undated: 0 };

  for (const fb of feedback ?? []) {
    if (fb.is_duplicate) {
      exclusions.duplicate += 1;
      continue;
    }
    const parsed = {
      publishedAt: fb.published_at,
      precision: fb.date_precision,
      original: null,
      crossesBoundaryRisk: fb.crosses_boundary_risk,
    };
    if (!fb.published_at) {
      exclusions.undated += 1;
      continue;
    }
    if (!isEligibleForPeriodComparison(parsed as never)) {
      exclusions.excluded += 1;
      continue;
    }
    const published = new Date(fb.published_at);
    if (published < periodStart || published > periodEnd) continue;

    const classification = Array.isArray(fb.classifications)
      ? fb.classifications[0]
      : fb.classifications;
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
    const aspects = (classification.aspects as Array<{
      key: string;
      sentiment: string;
      unmatched?: boolean;
    }>) ?? [];

    for (const aspect of aspects) {
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
      if (aspect.sentiment === "negative" || aspect.sentiment === "mixed") {
        byAspect[aspect.key].c += 1;
      }
      if (aspect.sentiment === "positive" || aspect.sentiment === "mixed") {
        byAspect[aspect.key].p += 1;
      }
      byAspect[aspect.key].evidenceIds.push(fb.id);
    }
  }

  for (const key of Object.keys(byAspect)) {
    byAspect[key].n = n;
    byAspect[key].exclusions = { ...exclusions };
  }
  return byAspect;
}

export const inngestFunctions = [syncPipeline];
