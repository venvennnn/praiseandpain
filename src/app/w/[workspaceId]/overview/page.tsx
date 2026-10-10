import Link from "next/link";
import { Target } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace/shell";
import { SyncLive } from "@/components/workspace/sync-live";
import { ThemeRank } from "@/components/workspace/theme-rank";
import { GeminiBrief } from "@/components/workspace/gemini-brief";
import { TrendSection } from "@/components/workspace/trend-section";
import { loadWorkspaceContext } from "@/lib/workspace-page";
import { integrationStatus } from "@/server/config/requirements";
import { geminiConfigured } from "@/server/gemini/brief";
import { feedbackLimitForPlan, planLabel } from "@/shared/plans";
import { formatPercent } from "@/lib/utils";
import { priorityPain, rankThemes, type RankedTheme } from "@/server/analysis/report-themes";
import { CLASSIFICATION_SCHEMA_VERSION, aspectLabel, isSpecificIssue } from "@/server/jev/taxonomy";
import type { MetricResult } from "@/shared/schemas/metrics";

const SOURCE_LABELS: Record<string, string> = {
  google_maps: "Google Maps",
  apple_app_store: "App Store",
  google_play: "Google Play",
  youtube: "YouTube",
  csv_import: "CSV import",
  json_import: "JSON import",
};

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await loadWorkspaceContext(workspaceId);
  const plan = (ctx.workspace as { plan?: string }).plan;
  const limit = feedbackLimitForPlan(plan);

  const { data: links } = await ctx.supabase
    .from("workspace_entities")
    .select("role, entity_id")
    .eq("workspace_id", workspaceId);
  const primaryId = (links ?? []).find((link) => link.role === "primary")?.entity_id;

  const { data: snapshots } = await ctx.supabase
    .from("metric_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("active", true)
    .order("created_at", { ascending: false });

  const snapshot =
    (snapshots ?? []).find((row) => row.entity_id === primaryId) ?? (snapshots ?? [])[0] ?? null;

  const { count: feedbackCount } = await ctx.supabase
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  const { data: run } = await ctx.supabase
    .from("collection_runs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: tasks } = await ctx.supabase
    .from("tasks")
    .select("id, title, status, aspect_key, description")
    .eq("workspace_id", workspaceId)
    .neq("status", "closed")
    .order("priority", { ascending: false, nullsFirst: false })
    .limit(3);

  const metrics = (snapshot?.metrics ?? {}) as Record<
    string,
    { praise_share?: MetricResult; complaint_share?: MetricResult }
  >;
  const praiseThemes = rankThemes(metrics, "praise", 5);
  const painThemes = rankThemes(metrics, "pain", 5);
  const priority = priorityPain(painThemes);
  const granular = [...praiseThemes, ...painThemes].some((theme) => isSpecificIssue(theme.key));

  const verdicts = (
    snapshot?.coverage as {
      verdicts?: { praise?: number; pain?: number; mixed?: number; plain?: number };
      sampled?: number;
    } | null
  )?.verdicts;
  const praiseCount = verdicts?.praise ?? 0;
  const painCount = verdicts?.pain ?? 0;
  const plainCount = (verdicts?.mixed ?? 0) + (verdicts?.plain ?? 0);
  const verdictTotal = praiseCount + painCount + plainCount;

  const { data: sourceRows } = primaryId
    ? await ctx.supabase
        .from("feedback")
        .select("source")
        .eq("workspace_id", workspaceId)
        .eq("entity_id", primaryId)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(limit)
    : { data: [] };
  const sources = [...new Set((sourceRows ?? []).map((row) => row.source).filter(Boolean))];

  const quote = primaryId ? await loadQuote(ctx.supabase, workspaceId, primaryId, priority?.key ?? null, ctx.workspace.timezone) : null;

  const moves = (tasks ?? []).length
    ? (tasks ?? []).map((task) => ({
        id: task.id,
        action: task.title,
        why: task.description || (task.aspect_key ? aspectLabel(task.aspect_key) : task.status),
        theme: task.aspect_key ? aspectLabel(task.aspect_key) : null,
        tone: "pain" as const,
        href: `/w/${workspaceId}/tasks`,
      }))
    : suggestedMoves(workspaceId, painThemes, praiseThemes);

  const fallbackHeadline = priority
    ? `${priority.label} is the priority.`
    : verdictTotal
      ? "No pain theme is strong enough to rank yet."
      : "Waiting for classified reviews.";
  const fallback = [
    verdictTotal
      ? `${ctx.workspace.name} is ${formatPercent(praiseCount / verdictTotal, 0)} praise and ${formatPercent(painCount / verdictTotal, 0)} pain across ${verdictTotal} classified reviews in the newest window.`
      : "Sync and classification have to finish before a summary can name a priority.",
    priority
      ? `${priority.label} accounts for ${formatPercent(priority.share, 0)} of its mentions (${priority.numerator ?? "—"} of ${priority.mentions}).`
      : "Pain themes appear once a topic is mentioned at least three times.",
    praiseThemes[0]
      ? `The strongest praise is ${praiseThemes[0].label} at ${formatPercent(praiseThemes[0].share, 0)} of its mentions.`
      : "Praise themes appear from the same classified window.",
  ];

  const periodLabel = snapshot?.period_start && snapshot?.period_end
    ? `${formatDay(snapshot.period_start, ctx.workspace.timezone)} – ${formatDay(snapshot.period_end, ctx.workspace.timezone)}`
    : `Newest ${limit}`;

  return (
    <WorkspaceShell
      workspaceId={workspaceId}
      workspaceName={ctx.workspace.name}
      providerStatus={ctx.providerStatus}
      active="overview"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--color-ink-muted)] uppercase">
            Feedback report
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
            {ctx.workspace.name} / Feedback overview
          </h1>
        </div>
        <Link
          href={`/w/${workspaceId}/reports`}
          className="rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium"
        >
          Export
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1">{periodLabel}</span>
        <span className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1">
          {sources.length ? sources.map((source) => SOURCE_LABELS[source] ?? source).join(", ") : "All sources"}
        </span>
        <span className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1">All ratings</span>
        <span className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1">{planLabel(plan)}</span>
      </div>

      <div className="mt-4">
        <SyncLive
          workspaceId={workspaceId}
          initialCount={feedbackCount ?? 0}
          initialRun={
            run
              ? {
                  id: run.id,
                  status: run.status,
                  stage: run.stage,
                  progress: (run.progress ?? null) as Record<string, unknown> | null,
                  error: run.error,
                }
              : null
          }
          serpapiReady={ctx.providerStatus.serpapi}
          jevReady={ctx.providerStatus.jev}
          inngestReady={integrationStatus().inngest}
          planLabelText={planLabel(plan)}
        />
      </div>

      {!ctx.providerStatus.serpapi || !ctx.providerStatus.jev ? (
        <div className="mt-4 border border-[var(--color-pain)] bg-white px-4 py-3 text-sm">
          <p className="font-semibold text-[var(--color-pain)]">Live stack required</p>
          <p className="mt-1 text-[var(--color-ink)]">
            SerpApi collects real reviews. TypeSafe/Jev classifies them. The report stays empty until both are configured.
          </p>
        </div>
      ) : null}

      <section className="mt-6 rounded-2xl bg-[var(--color-highlight)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[var(--color-action)]">
              <Target className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-[var(--color-action)] uppercase">
                What needs your attention?
              </p>
              <p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">{fallbackHeadline}</p>
              <p className="mt-1 max-w-xl text-sm text-[var(--color-ink-muted)]">
                {priority
                  ? `${formatPercent(priority.share, 0)} of mentions are negative. ${granular ? "Ranked from the specific issue, not only the broad theme." : "Specific issues appear after the next sync reclassifies reviews."}`
                  : "Ranks use the newest reviews in the plan window."}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-4 text-right">
            <div>
              <dt className="text-xs text-[var(--color-ink-muted)]">Reviews</dt>
              <dd className="font-[family-name:var(--font-display)] text-2xl">{verdictTotal || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-ink-muted)]">Sources</dt>
              <dd className="font-[family-name:var(--font-display)] text-2xl">{sources.length || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-ink-muted)]">Themes</dt>
              <dd className="font-[family-name:var(--font-display)] text-2xl">
                {praiseThemes.length + painThemes.length || "—"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="mt-4">
        <GeminiBrief
          title="Gemini summary"
          ready={geminiConfigured()}
          fallbackHeadline={fallbackHeadline}
          fallback={fallback}
          endpoint={`/api/workspaces/${workspaceId}/insight-brief`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ThemeRank
          title="Praise themes"
          tone="praise"
          rows={praiseThemes}
          seeAllHref={`/w/${workspaceId}/feedback`}
          empty={feedbackCount ? "Classification has not produced praise themes yet." : "No feedback collected."}
        />
        <ThemeRank
          title="Pain themes"
          tone="pain"
          rows={painThemes}
          seeAllHref={`/w/${workspaceId}/feedback`}
          empty={feedbackCount ? "Classification has not produced pain themes yet." : "No feedback collected."}
        />
      </div>

      <section className="report-card mt-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">Your next moves</h2>
          <Link href={`/w/${workspaceId}/tasks`} className="text-sm font-semibold text-[var(--color-action)]">
            See all actions
          </Link>
        </div>
        {moves.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
            Moves appear from open tasks or from the highest pain and praise themes.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-ink-muted)]">
                  <th className="py-2 font-medium">#</th>
                  <th className="py-2 font-medium">Action</th>
                  <th className="py-2 font-medium">Why it matters</th>
                  <th className="py-2 font-medium">Related theme</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((move, index) => (
                  <tr key={move.id} className="border-b border-[var(--color-border)]">
                    <td className="py-3 pr-3 text-[var(--color-ink-muted)]">{index + 1}</td>
                    <td className="py-3 pr-3 font-medium">
                      <Link href={move.href}>{move.action}</Link>
                    </td>
                    <td className="py-3 pr-3 text-[var(--color-ink-muted)]">{move.why}</td>
                    <td className="py-3">
                      {move.theme ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            move.tone === "praise"
                              ? "bg-[var(--color-praise-soft)] text-[var(--color-praise)]"
                              : "bg-[var(--color-pain-soft)] text-[var(--color-pain)]"
                          }`}
                        >
                          {move.theme}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="report-card mt-4 p-5">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">Source evidence</h2>
        {quote ? (
          <figure className="mt-4">
            <blockquote className="text-lg leading-7 text-[var(--color-ink)]">“{quote.text}”</blockquote>
            <figcaption className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-muted)]">
              <span>{SOURCE_LABELS[quote.source] ?? quote.source}</span>
              {quote.rating != null ? <span>{"★".repeat(Math.round(quote.rating))}</span> : null}
              {quote.when ? <span>{quote.when}</span> : null}
              {quote.url ? (
                <a className="font-semibold text-[var(--color-action)]" href={quote.url} target="_blank" rel="noreferrer">
                  Open original
                </a>
              ) : null}
            </figcaption>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {quote.theme ? (
                <span className="rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 font-semibold">{quote.theme}</span>
              ) : null}
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  quote.sentiment === "negative"
                    ? "bg-[var(--color-pain-soft)] text-[var(--color-pain)]"
                    : quote.sentiment === "positive"
                      ? "bg-[var(--color-praise-soft)] text-[var(--color-praise)]"
                      : "bg-white text-[var(--color-ink-muted)] ring-1 ring-[var(--color-border)]"
                }`}
              >
                {quote.sentiment === "negative" ? "Negative" : quote.sentiment === "positive" ? "Positive" : "Uncategorised"}
              </span>
            </div>
          </figure>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
            A quote appears here once a collected review is stored for this place.
          </p>
        )}
      </section>

      <TrendSection supabase={ctx.supabase} workspaceId={workspaceId} plan={plan} timeZone={ctx.workspace.timezone} />
    </WorkspaceShell>
  );
}

function suggestedMoves(workspaceId: string, pain: RankedTheme[], praise: RankedTheme[]) {
  const moves: Array<{
    id: string;
    action: string;
    why: string;
    theme: string | null;
    tone: "praise" | "pain";
    href: string;
  }> = [];
  if (pain[0]) {
    moves.push({
      id: `pain-${pain[0].key}`,
      action: `Investigate ${pain[0].label.toLowerCase()}`,
      why: `${formatPercent(pain[0].share, 0)} of mentions are negative (${pain[0].numerator ?? "—"} of ${pain[0].mentions}).`,
      theme: pain[0].label,
      tone: "pain",
      href: `/w/${workspaceId}/feedback`,
    });
  }
  if (praise[0]) {
    moves.push({
      id: `praise-${praise[0].key}`,
      action: `Protect ${praise[0].label.toLowerCase()}`,
      why: `${formatPercent(praise[0].share, 0)} of mentions are positive (${praise[0].numerator ?? "—"} of ${praise[0].mentions}).`,
      theme: praise[0].label,
      tone: "praise",
      href: `/w/${workspaceId}/feedback`,
    });
  }
  if (pain[1]) {
    moves.push({
      id: `pain-${pain[1].key}`,
      action: `Review ${pain[1].label.toLowerCase()}`,
      why: `Second pain theme, ${formatPercent(pain[1].share, 0)} negative across ${pain[1].mentions} mentions.`,
      theme: pain[1].label,
      tone: "pain",
      href: `/w/${workspaceId}/feedback`,
    });
  }
  return moves;
}

async function loadQuote(
  supabase: Awaited<ReturnType<typeof loadWorkspaceContext>>["supabase"],
  workspaceId: string,
  entityId: string,
  painKey: string | null,
  timeZone: string,
) {
  const { data } = await supabase
    .from("feedback")
    .select(
      "original_text, published_at, source, rating, source_url, classifications(schema_version, status, is_complaint, aspects, evidence_spans(excerpt, aspect_key, sentiment))",
    )
    .eq("workspace_id", workspaceId)
    .eq("entity_id", entityId)
    .eq("is_duplicate", false)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(40);

  const rows = (data ?? []).map((row) => {
    const list = Array.isArray(row.classifications) ? row.classifications : row.classifications ? [row.classifications] : [];
    const classification =
      list.find((item) => item.schema_version === CLASSIFICATION_SCHEMA_VERSION) ??
      list.find((item) => item.status && item.status !== "failed") ??
      null;
    const spans = classification
      ? Array.isArray(classification.evidence_spans)
        ? classification.evidence_spans
        : classification.evidence_spans
          ? [classification.evidence_spans]
          : []
      : [];
    const aspects = (classification?.aspects ?? []) as Array<{ key?: string; sentiment?: string }>;
    const matchingSpan =
      spans.find((span) => span.aspect_key === painKey) ??
      spans.find((span) => span.sentiment === "negative") ??
      spans[0];
    return {
      text: clip(matchingSpan?.excerpt || row.original_text),
      source: row.source as string,
      rating: row.rating as number | null,
      url: row.source_url as string | null,
      when: row.published_at ? formatDay(row.published_at, timeZone) : null,
      theme: matchingSpan?.aspect_key
        ? aspectLabel(matchingSpan.aspect_key)
        : aspects[0]?.key
          ? aspectLabel(aspects[0].key)
          : null,
      sentiment: (matchingSpan?.sentiment ?? aspects[0]?.sentiment ?? null) as string | null,
      isComplaint: Boolean(classification?.is_complaint),
      keys: aspects.map((aspect) => aspect.key),
    };
  });

  return (
    rows.find((row) => painKey && row.keys.includes(painKey)) ??
    rows.find((row) => row.isComplaint) ??
    rows[0] ??
    null
  );
}

function clip(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 320 ? `${clean.slice(0, 317)}…` : clean;
}

function formatDay(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone }).format(date);
}
