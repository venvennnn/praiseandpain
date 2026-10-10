import type { ConnectorAdapter, DiscoveredEntity, FetchPageResult } from "./types";
import { serpApiFetch } from "./serpapi";

/**
 * Verified: engine=google_play_product with store=apps, all_reviews=true.
 * Pagination via next_page_token.
 * sort_by=2 for newest.
 */
export const googlePlayConnector: ConnectorAdapter = {
  source: "google_play",
  capabilities: {
    chronologicalSort: true,
    pagination: "next_page_token",
    transcripts: false,
    requiresSeparateMetaRequest: true,
  },

  async discover(query) {
    const { data } = await serpApiFetch({
      engine: "google_play",
      q: query,
      store: "apps",
    });
    const organic =
      (data.organic_results as Array<Record<string, unknown>>) ??
      ((data.apps_results as Array<Record<string, unknown>>) ?? []);
    return organic.map((r): DiscoveredEntity => {
      const id = String(r.product_id ?? r.app_id ?? "");
      const link = typeof r.link === "string" ? r.link : undefined;
      return {
        providerId: id,
        name: String(r.title ?? ""),
        source: "google_play",
        url: link,
        platformIdentifiers: { product_id: id },
        channelOrAppLinks: link ? [link] : [],
        metadata: { rating: r.rating, developer: r.author, downloads: r.downloads },
        snippet: typeof r.description === "string" ? r.description.slice(0, 160) : undefined,
      };
    }).filter((d) => d.providerId);
  },

  async fetchDetails(providerId) {
    const { data } = await serpApiFetch({
      engine: "google_play_product",
      product_id: providerId,
      store: "apps",
    });
    const product = (data.product_info as Record<string, unknown>) ?? data;
    return {
      providerId,
      name: String(product.title ?? ""),
      source: "google_play",
      url: typeof product.link === "string" ? product.link : undefined,
      platformIdentifiers: { product_id: providerId },
      channelOrAppLinks: typeof product.link === "string" ? [product.link] : [],
      metadata: product,
    };
  },

  async fetchFeedbackPage(providerId, cursor) {
    const params: Record<string, string | number | boolean | undefined> = {
      engine: "google_play_product",
      product_id: providerId,
      store: "apps",
      all_reviews: true,
      sort_by: 2,
    };
    if (cursor && typeof cursor === "string") {
      params.next_page_token = cursor;
    }
    const { data, cacheHit } = await serpApiFetch(params);
    const reviews = (data.reviews as Array<Record<string, unknown>>) ?? [];
    let missingDates = 0;
    const records = reviews.map((r) => {
      const date =
        (typeof r.iso_date === "string" && r.iso_date) ||
        (typeof r.date === "string" && r.date) ||
        null;
      if (!date) missingDates += 1;
      return {
        providerId: String(r.id ?? `${providerId}:${r.title}:${date}`),
        text: String(r.snippet ?? r.text ?? ""),
        originalDateString: date,
        rating: typeof r.rating === "number" ? r.rating : null,
        language: null,
        sourceUrl: null,
        authorName: typeof r.title === "string" ? r.title : null,
        raw: r,
      };
    }).filter((r) => r.text);

    const pagination = data.serpapi_pagination as { next_page_token?: string } | undefined;
    const next = pagination?.next_page_token ?? null;
    return {
      records,
      cursor: next,
      hasMore: Boolean(next),
      quota: {
        requestsUsed: 1,
        estimatedCost: 1,
        confirmedUsage: null,
        cacheHits: cacheHit ? 1 : 0,
      },
      coverage: {
        pageCapReached: !next,
        sortOrder: "newest",
        truncated: false,
        missingDates,
        repliesFollowed: 0,
      },
    } satisfies FetchPageResult;
  },
};
