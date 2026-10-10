import type { ConnectorAdapter, DiscoveredEntity, FetchPageResult } from "./types";
import { serpApiFetch } from "./serpapi";

/**
 * Verified: engine=apple_reviews, product_id required.
 * Discovery via engine=apple_app_store.
 * Pagination via page (serpapi_pagination.next).
 * sort=mostrecent for chronological preference.
 */
export const appleAppStoreConnector: ConnectorAdapter = {
  source: "apple_app_store",
  capabilities: {
    chronologicalSort: true,
    pagination: "page",
    transcripts: false,
    requiresSeparateMetaRequest: true,
  },

  async discover(query, opts = {}) {
    const { data } = await serpApiFetch({
      engine: "apple_app_store",
      term: query,
      country: opts.region ?? "us",
    });
    const organic = (data.organic_results as Array<Record<string, unknown>>) ?? [];
    return organic.map((r): DiscoveredEntity => {
      const id = String(r.id ?? r.product_id ?? "");
      const link = typeof r.link === "string" ? r.link : undefined;
      return {
        providerId: id,
        name: String(r.title ?? ""),
        source: "apple_app_store",
        url: link,
        location: undefined,
        platformIdentifiers: { product_id: id, bundle_id: String(r.bundle_id ?? "") },
        channelOrAppLinks: link ? [link] : [],
        metadata: { rating: r.rating, genre: r.genre, developer: r.developer },
        snippet: typeof r.description === "string" ? r.description.slice(0, 160) : undefined,
      };
    }).filter((d) => d.providerId);
  },

  async fetchDetails(providerId) {
    const { data } = await serpApiFetch({
      engine: "apple_product",
      product_id: providerId,
      type: "app",
    });
    const app = (data.app_results as Record<string, unknown>) ?? data;
    return {
      providerId,
      name: String(app.title ?? ""),
      source: "apple_app_store",
      url: typeof app.link === "string" ? app.link : undefined,
      platformIdentifiers: { product_id: providerId },
      channelOrAppLinks: typeof app.link === "string" ? [app.link] : [],
      metadata: app,
    };
  },

  async fetchFeedbackPage(providerId, cursor) {
    const page = typeof cursor === "number" ? cursor : cursor ? Number(cursor) : 1;
    const { data, cacheHit } = await serpApiFetch({
      engine: "apple_reviews",
      product_id: providerId,
      page,
      sort: "mostrecent",
    });
    const reviews = (data.reviews as Array<Record<string, unknown>>) ?? [];
    let missingDates = 0;
    const records = reviews.map((r) => {
      const date = typeof r.review_date === "string" ? r.review_date : null;
      if (!date) missingDates += 1;
      const text = [r.title, r.text].filter(Boolean).join("\n");
      return {
        providerId: String(r.id ?? `${providerId}:${page}:${r.position}`),
        text,
        originalDateString: date,
        rating: typeof r.rating === "number" ? r.rating : null,
        language: null,
        sourceUrl: null,
        authorName:
          typeof (r.author as { name?: string } | undefined)?.name === "string"
            ? (r.author as { name: string }).name
            : null,
        raw: r,
      };
    }).filter((r) => r.text);

    const pagination = data.serpapi_pagination as { next?: string } | undefined;
    const hasMore = Boolean(pagination?.next);
    return {
      records,
      cursor: hasMore ? page + 1 : null,
      hasMore,
      quota: {
        requestsUsed: 1,
        estimatedCost: 1,
        confirmedUsage: null,
        cacheHits: cacheHit ? 1 : 0,
      },
      coverage: {
        pageCapReached: !hasMore,
        sortOrder: "mostrecent",
        truncated: false,
        missingDates,
        repliesFollowed: 0,
      },
    } satisfies FetchPageResult;
  },
};
