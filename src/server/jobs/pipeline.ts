import { createServiceClient } from "@/lib/supabase/server";
import { assertRunOwnership } from "@/server/auth/permissions";
import { getConnector, serpApiConfigured } from "@/server/connectors";
import { ConnectorConfigError } from "@/server/connectors/serpapi";
import { parseFeedbackDate } from "@/server/analysis/dates";
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
import { feedbackLimitForPlan, pagesToCoverNewest } from "@/shared/plans";
import { CLASSIFICATION_SCHEMA_VERSION } from "@/server/jev/taxonomy";

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

    const perEntityLimit = feedbackLimitForPlan((workspace as { plan?: string }).plan);
    const pageBudget = pagesToCoverNewest(perEntityLimit);
    const pagesPerStep = 6;
    const collectBatches = Math.max(1, Math.ceil(pageBudget / pagesPerStep));

    if (!serpApiConfigured()) {
      await step.run("collect-fail-no-serpapi", async () => {
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
      });
    }

    let collectedCount = 0;
    const failures: Array<{ entityId: string; error: string }> = [];
    let fatalConfig = false;

    for (let entityIndex = 0; entityIndex < entities.entities.length; entityIndex++) {
      if (fatalConfig) break;
      const entity = entities.entities[entityIndex];
      const source = entity.source as SourceType;
      if (source === "csv_import" || source === "json_import") continue;

      let cursor: string | null = null;
      let covered = 0;
      let entityDone = false;

      for (let batch = 0; batch < collectBatches && !entityDone; batch++) {
        const piece = await step.run(`collect-e${entityIndex}-b${batch}`, async () => {
          const svc = createServiceClient();
          try {
            const connector = getConnector(source);
            const { data: ws } = await svc
              .from("workspaces")
              .select("usage_consumed, usage_limit")
              .eq("id", workspaceId)
              .single();
            if (!ws || ws.usage_consumed >= ws.usage_limit) {
              return {
                added: 0,
                covered,
                cursor,
                done: true,
                error: "Usage limit reached",
                fatal: false,
              };
            }

            let localCursor = cursor;
            let localCovered = covered;
            let added = 0;
            let pages = 0;
            let done = false;

            while (pages < pagesPerStep && localCovered < perEntityLimit) {
              const remaining = ws.usage_limit - ws.usage_consumed;
              if (remaining <= 0) {
                done = true;
                break;
              }
              const page = await connector.fetchFeedbackPage(entity.provider_id, localCursor, {
                budgetRemaining: remaining,
              });
              await svc.from("provider_calls").insert({
                workspace_id: workspaceId,
                run_id: runId,
                provider: "serpapi",
                operation: `${source}.fetchFeedbackPage`,
                estimated_cost: page.quota.estimatedCost,
                confirmed_usage: page.quota.confirmedUsage,
                cache_hit: page.quota.cacheHits > 0,
                success: true,
              });
              await svc
                .from("workspaces")
                .update({ usage_consumed: ws.usage_consumed + page.quota.requestsUsed })
                .eq("id", workspaceId);
              ws.usage_consumed += page.quota.requestsUsed;

              for (const record of page.records) {
                if (localCovered >= perEntityLimit) break;
                const parsed = parseFeedbackDate(record.originalDateString);
                const hash = contentHash(record.text);
                const { error } = await svc.from("feedback").upsert(
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
                if (!error) added += 1;
                localCovered += 1;
              }

              localCursor = typeof page.cursor === "string" ? page.cursor : null;
              pages += 1;
              if (!page.hasMore || localCovered >= perEntityLimit) {
                done = true;
                break;
              }
            }

            return {
              added,
              covered: localCovered,
              cursor: localCursor,
              done,
              error: null as string | null,
              fatal: false,
            };
          } catch (err) {
            const message =
              err instanceof ConnectorConfigError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : "collect failed";
            return {
              added: 0,
              covered,
              cursor,
              done: true,
              error: message,
              fatal: err instanceof ConnectorConfigError,
            };
          }
        });

        collectedCount += piece.added;
        covered = piece.covered;
        cursor = piece.cursor;
        if (piece.error) {
          failures.push({ entityId: entity.id, error: piece.error });
          entityDone = true;
          if (piece.fatal) fatalConfig = true;
        } else if (piece.done) {
          entityDone = true;
        }

        await step.run(`collect-progress-e${entityIndex}-b${batch}`, async () => {
          await updateRun(runId, {
            status: "running",
            stage: "collect",
            progress: {
              collectedCount,
              covered,
              perEntityLimit,
              entityIndex,
              entityCount: entities.entities.length,
              failures,
            },
          });
        });
      }

      const connection = Array.isArray(entity.source_connections)
        ? entity.source_connections[0]
        : entity.source_connections;
      if (connection?.id) {
        await step.run(`collect-cursor-e${entityIndex}`, async () => {
          const svc = createServiceClient();
          await svc
            .from("source_connections")
            .update({ cursor: null, last_synced_at: new Date().toISOString() })
            .eq("id", connection.id);
        });
      }
    }

    const collected = await step.run("collect-finish", async () => {
      if (fatalConfig) {
        const message = failures[0]?.error ?? "SerpApi collection failed";
        await updateRun(runId, {
          status: "failed",
          stage: "collect",
          error: message,
          completed_at: new Date().toISOString(),
          progress: { collectedCount, failures, perEntityLimit },
        });
        throw new Error(message);
      }
      await updateRun(runId, {
        stage: "classify",
        progress: { collectedCount, failures, perEntityLimit },
      });
      return { collectedCount, failures, perEntityLimit };
    });

    // Big parallel Jev batches (one HTTP call per review; API has no multi-review bulk endpoint).
    // Keep step-sized chunks so Inngest/Vercel time limits are not blown, but make them large.
    const CLASSIFY_BATCH = 80;
    const CLASSIFY_CONCURRENCY = 20;
    const MAX_CLASSIFY_BATCHES = 40;
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

        const perEntityLimit = feedbackLimitForPlan(
          (workspace as { plan?: string }).plan,
        );
        const { data: already } = await svc
          .from("classifications")
          .select("feedback_id, schema_version")
          .eq("workspace_id", workspaceId)
          .eq("schema_version", CLASSIFICATION_SCHEMA_VERSION)
          .limit(8000);
        const classifiedSet = new Set((already ?? []).map((row) => row.feedback_id));

        const { data: entityRows } = await svc
          .from("workspace_entities")
          .select("entity_id")
          .eq("workspace_id", workspaceId);

        const newestIds = new Set<string>();
        const newestText = new Map<string, string>();
        for (const link of entityRows ?? []) {
          const { data: newest } = await svc
            .from("feedback")
            .select("id, original_text")
            .eq("workspace_id", workspaceId)
            .eq("entity_id", link.entity_id)
            .eq("is_duplicate", false)
            .order("published_at", { ascending: false, nullsFirst: false })
            .limit(perEntityLimit);
          for (const row of newest ?? []) {
            newestIds.add(row.id);
            newestText.set(row.id, row.original_text);
          }
        }

        const rows = [...newestIds].map((id) => ({
          id,
          original_text: newestText.get(id) ?? "",
        }));

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
        const scoped = await computeAspectCounts(
          service,
          workspaceId,
          link.entity_id,
          perEntityLimit,
        );
        const samplePeriod = {
          start: scoped.oldest ?? period.start,
          end: scoped.newest ?? period.end,
          timezone: period.timezone,
        };

        const metrics: Record<string, unknown> = {};
        for (const [aspectKey, counts] of Object.entries(scoped.byAspect)) {
          metrics[aspectKey] = {
            prevalence: prevalence(counts, samplePeriod),
            complaint_share: complaintShare(counts, samplePeriod),
            praise_share: praiseShare(counts, samplePeriod),
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
          period_start: samplePeriod.start,
          period_end: samplePeriod.end,
          filters: { source: null, newest: perEntityLimit },
          coverage: {
            note: "newest_reviews_per_place",
            perEntityLimit,
            sampled: scoped.sampled,
            verdicts: scoped.verdicts,
          },
          metrics,
          formula_version: CALCULATION_VERSION,
          active: true,
        });
      }

      const primary = (entityLinks ?? []).find((e) => e.role === "primary");
      const competitors = (entityLinks ?? []).filter((e) => e.role === "competitor");
      const comparisons = [];

      if (primary) {
        const primaryScoped = await computeAspectCounts(
          service,
          workspaceId,
          primary.entity_id,
          perEntityLimit,
        );
        const primaryCounts = primaryScoped.byAspect;
        for (const competitor of competitors) {
          const competitorCounts = (
            await computeAspectCounts(
              service,
              workspaceId,
              competitor.entity_id,
              perEntityLimit,
            )
          ).byAspect;
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
  perEntityLimit: number,
): Promise<{
  byAspect: Record<string, AspectCounts>;
  verdicts: { praise: number; pain: number; mixed: number; plain: number };
  sampled: number;
  oldest: string | null;
  newest: string | null;
}> {
  const { data: feedback } = await service
    .from("feedback")
    .select(
      "id, published_at, is_duplicate, classifications(schema_version, status, is_praise, is_complaint, is_irrelevant, aspects)",
    )
    .eq("workspace_id", workspaceId)
    .eq("entity_id", entityId)
    .eq("is_duplicate", false)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(perEntityLimit);

  const byAspect: Record<string, AspectCounts> = {};
  const verdicts = { praise: 0, pain: 0, mixed: 0, plain: 0 };
  let n = 0;
  const exclusions = { excluded: 0, uncertain: 0, duplicate: 0, undated: 0 };
  const rows = feedback ?? [];
  const dated = rows.map((row) => row.published_at).filter((value): value is string => Boolean(value));

  for (const fb of rows) {
    if (!fb.published_at) exclusions.undated += 1;

    const classification = pickClassification(fb.classifications);
    if (!classification || classification.status === "failed") {
      exclusions.excluded += 1;
      verdicts.plain += 1;
      continue;
    }
    if (classification.status === "uncertain") exclusions.uncertain += 1;
    if (classification.is_irrelevant) {
      exclusions.excluded += 1;
      verdicts.plain += 1;
      continue;
    }

    if (classification.is_praise && classification.is_complaint) verdicts.mixed += 1;
    else if (classification.is_praise) verdicts.praise += 1;
    else if (classification.is_complaint) verdicts.pain += 1;
    else verdicts.plain += 1;

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
  return {
    byAspect,
    verdicts,
    sampled: rows.length,
    oldest: dated.length ? dated[dated.length - 1] : null,
    newest: dated.length ? dated[0] : null,
  };
}

function pickClassification(
  raw:
    | {
        schema_version?: string;
        status?: string;
        is_praise?: boolean | null;
        is_complaint?: boolean | null;
        is_irrelevant?: boolean | null;
        aspects?: unknown;
      }
    | Array<{
        schema_version?: string;
        status?: string;
        is_praise?: boolean | null;
        is_complaint?: boolean | null;
        is_irrelevant?: boolean | null;
        aspects?: unknown;
      }>
    | null,
) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return (
    list.find((row) => row.schema_version === CLASSIFICATION_SCHEMA_VERSION) ??
    list.find((row) => row.status && row.status !== "failed") ??
    null
  );
}

export const inngestFunctions = [syncPipeline];
