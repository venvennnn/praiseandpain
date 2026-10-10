import { TrendCharts } from "@/components/charts/trend-charts";
import { loadWorkspaceContext } from "@/lib/workspace-page";
import { feedbackLimitForPlan, planLabel } from "@/shared/plans";
import { CLASSIFICATION_SCHEMA_VERSION } from "@/server/jev/taxonomy";
import { buildTrends, type TrendAspect, type TrendReview } from "@/server/analysis/trends";

type ClassificationRow = {
  schema_version?: string;
  status?: string | null;
  is_praise?: boolean | null;
  is_complaint?: boolean | null;
  is_irrelevant?: boolean | null;
  aspects?: TrendAspect[] | null;
};

export async function TrendSection({
  supabase,
  workspaceId,
  plan,
  timeZone,
}: {
  supabase: Awaited<ReturnType<typeof loadWorkspaceContext>>["supabase"];
  workspaceId: string;
  plan: string | null | undefined;
  timeZone: string;
}) {
  const limit = feedbackLimitForPlan(plan);
  const { data: links } = await supabase
    .from("workspace_entities")
    .select("role, entity_id, entity:entities(id, name)")
    .eq("workspace_id", workspaceId);

  const places = [];
  for (const link of links ?? []) {
    const entity = Array.isArray(link.entity) ? link.entity[0] : link.entity;
    const name = entity?.name ?? "Place";
    const { data } = await supabase
      .from("feedback")
      .select(
        "published_at, rating, is_duplicate, classifications(schema_version, status, is_praise, is_complaint, is_irrelevant, aspects)",
      )
      .eq("workspace_id", workspaceId)
      .eq("entity_id", link.entity_id)
      .eq("is_duplicate", false)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    const reviews = (data ?? []).map(toTrendReview);
    places.push({
      id: link.entity_id as string,
      name,
      role: link.role as string,
      series: buildTrends(reviews, { timeZone }),
    });
  }

  const ordered = [
    ...places.filter((place) => place.role === "primary"),
    ...places.filter((place) => place.role !== "primary"),
  ];

  return (
    <section id="trends" className="mt-12 rounded-xl border border-[var(--color-border)] bg-white p-4">
      <p className="mb-4 text-xs text-[var(--color-ink-muted)]">
        {planLabel(plan)}. Each series uses only that newest window, counted separately for you and for
        each competitor.
      </p>
      {ordered.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Add a place before trends can be calculated.</p>
      ) : (
        <TrendCharts places={ordered} />
      )}
    </section>
  );
}

function toTrendReview(row: {
  published_at: string | null;
  rating: number | null;
  classifications: ClassificationRow | ClassificationRow[] | null;
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
