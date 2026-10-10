import type { ConnectorAdapter, DiscoveredEntity, FetchPageResult } from "./types";
import { serpApiFetch } from "./serpapi";

/**
 * Verified against SerpApi docs:
 * - Discovery: engine=google_maps
 * - Reviews: engine=google_maps_reviews with data_id or place_id
 * - Pagination: next_page_token (not start)
 * - First page returns 8 reviews; num only with next_page_token/topic_id/query
 * - sort_by=newestFirst for chronological preference
 */
export const googleMapsConnector: ConnectorAdapter = {
  source: "google_maps",
  capabilities: {
    chronologicalSort: true,
    pagination: "next_page_token",
    transcripts: false,
    requiresSeparateMetaRequest: false,
  },

  async discover(query, opts = {}) {
    const { data } = await serpApiFetch({
      engine: "google_maps",
      q: query,
      hl: opts.language ?? "en",
      type: "search",
    });
    const local = (data.local_results as Array<Record<string, unknown>>) ?? [];
    return local.map((r): DiscoveredEntity => ({
      providerId: String(r.place_id ?? r.data_id ?? ""),
      name: String(r.title ?? ""),
      source: "google_maps",
      url: typeof r.link === "string" ? r.link : undefined,
      location: typeof r.address === "string" ? r.address : undefined,
      platformIdentifiers: {
        place_id: String(r.place_id ?? ""),
        data_id: String(r.data_id ?? ""),
      },
      channelOrAppLinks: typeof r.link === "string" ? [r.link] : [],
      metadata: {
        rating: r.rating,
        reviews: r.reviews,
        type: r.type,
        gps_coordinates: r.gps_coordinates,
      },
      snippet: typeof r.type === "string" ? r.type : undefined,
    })).filter((d) => d.providerId);
  },

  async fetchDetails(providerId) {
    const { data } = await serpApiFetch({
      engine: "google_maps",
      place_id: providerId,
      type: "place",
      hl: "en",
    });
    const place = (data.place_results as Record<string, unknown>) ?? data;
    return {
      providerId,
      name: String(place.title ?? ""),
      source: "google_maps",
      url: typeof place.link === "string" ? place.link : undefined,
      location: typeof place.address === "string" ? place.address : undefined,
      platformIdentifiers: {
        place_id: providerId,
        data_id: String(place.data_id ?? ""),
      },
      channelOrAppLinks: typeof place.link === "string" ? [place.link] : [],
      metadata: place,
    };
  },

  async fetchFeedbackPage(providerId, cursor) {
    const params: Record<string, string | number | boolean | undefined> = {
      engine: "google_maps_reviews",
      place_id: providerId,
      hl: "en",
      sort_by: "newestFirst",
    };
    if (cursor && typeof cursor === "string") {
      params.next_page_token = cursor;
      params.num = 20;
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
      const user = r.user as { name?: string } | undefined;
      const authorName = typeof user?.name === "string" ? user.name : null;
      return {
        providerId: String(r.review_id ?? r.link ?? `${providerId}:${authorName}:${date}`),
        text: String(
          (r.extracted_snippet as { original?: string } | undefined)?.original ??
            r.snippet ??
            "",
        ),
        originalDateString: date,
        rating: typeof r.rating === "number" ? r.rating : null,
        language: null,
        sourceUrl: typeof r.link === "string" ? r.link : null,
        authorName,
        raw: r,
      };
    }).filter((r) => r.text);

    const pagination = data.serpapi_pagination as { next_page_token?: string } | undefined;
    const next = pagination?.next_page_token ?? null;

    const result: FetchPageResult = {
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
        sortOrder: "newestFirst",
        truncated: false,
        missingDates,
        repliesFollowed: 0,
      },
    };
    return result;
  },
};
