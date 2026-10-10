import type { ConnectorAdapter, DiscoveredEntity, FetchPageResult } from "./types";
import { serpApiFetch } from "./serpapi";

/**
 * Verified:
 * - Channel/video discovery: engine=youtube
 * - Video metadata + comments: engine=youtube_video&v=
 * - Comments pagination: comments_next_page_token or comments_sorting_token.token
 *   via next_page_token (separate from related videos)
 * - Transcripts: engine=youtube_video_transcript when available
 * Video metadata and comment pages require separate request patterns.
 */
export const youtubeConnector: ConnectorAdapter = {
  source: "youtube",
  capabilities: {
    chronologicalSort: true,
    pagination: "next_page_token",
    transcripts: true,
    requiresSeparateMetaRequest: true,
  },

  async discover(query) {
    const { data } = await serpApiFetch({
      engine: "youtube",
      search_query: query,
    });
    const results =
      (data.channel_results as Array<Record<string, unknown>>) ??
      (data.video_results as Array<Record<string, unknown>>) ??
      [];
    const videos = (data.video_results as Array<Record<string, unknown>>) ?? [];
    const channels = (data.channel_results as Array<Record<string, unknown>>) ?? [];
    const combined = [...channels, ...videos];
    const sourceList = combined.length ? combined : results;

    return sourceList.map((r): DiscoveredEntity => {
      const channelId =
        typeof (r.channel as { id?: string } | undefined)?.id === "string"
          ? (r.channel as { id: string }).id
          : String(r.channel_id ?? "");
      const videoId = String(r.video_id ?? r.id ?? "");
      const providerId = channelId || videoId;
      const link = typeof r.link === "string" ? r.link : undefined;
      return {
        providerId,
        name: String(r.title ?? (r.channel as { name?: string } | undefined)?.name ?? ""),
        source: "youtube",
        url: link,
        platformIdentifiers: {
          channel_id: channelId,
          video_id: videoId,
        },
        channelOrAppLinks: link ? [link] : [],
        metadata: {
          views: r.views,
          published_date: r.published_date,
          description: r.description,
        },
        snippet: typeof r.description === "string" ? r.description.slice(0, 160) : undefined,
      };
    }).filter((d) => d.providerId);
  },

  async fetchDetails(providerId) {
    // Treat providerId as video id for details; channel-level collection uses video list separately.
    const { data } = await serpApiFetch({
      engine: "youtube_video",
      v: providerId,
    });
    const title = String(
      (data.title as string) ??
        (data.video_results as Record<string, unknown> | undefined)?.title ??
        "",
    );
    return {
      providerId,
      name: title,
      source: "youtube",
      url: `https://www.youtube.com/watch?v=${providerId}`,
      platformIdentifiers: { video_id: providerId },
      channelOrAppLinks: [`https://www.youtube.com/watch?v=${providerId}`],
      metadata: data,
    };
  },

  async fetchFeedbackPage(providerId, cursor, opts) {
    const params: Record<string, string | number | boolean | undefined> = {
      engine: "youtube_video",
      v: providerId,
    };

    if (!cursor) {
      // First request: load video to obtain newest-sort token when available.
      const { data, cacheHit } = await serpApiFetch(params);
      const sorting = (data.comments_sorting_token as Array<{ title?: string; token?: string }>) ?? [];
      const newest = sorting.find((t) => /newest/i.test(t.title ?? ""));
      const token =
        newest?.token ??
        (typeof data.comments_next_page_token === "string"
          ? data.comments_next_page_token
          : null);

      // If we already have comments on first payload, parse them.
      const comments = (data.comments as Array<Record<string, unknown>>) ?? [];
      if (comments.length) {
        return parseComments(comments, token, cacheHit, opts?.budgetRemaining);
      }

      if (!token) {
        return emptyPage(cacheHit);
      }
      // Follow newest token as next page request.
      const page = await serpApiFetch({
        engine: "youtube_video",
        v: providerId,
        next_page_token: token,
      });
      const pageComments = (page.data.comments as Array<Record<string, unknown>>) ?? [];
      const next =
        typeof page.data.comments_next_page_token === "string"
          ? page.data.comments_next_page_token
          : null;
      return parseComments(pageComments, next, page.cacheHit, opts?.budgetRemaining);
    }

    const { data, cacheHit } = await serpApiFetch({
      engine: "youtube_video",
      v: providerId,
      next_page_token: String(cursor),
    });
    const comments = (data.comments as Array<Record<string, unknown>>) ?? [];
    const next =
      typeof data.comments_next_page_token === "string"
        ? data.comments_next_page_token
        : null;
    return parseComments(comments, next, cacheHit, opts?.budgetRemaining);
  },

  async fetchTranscript(providerId) {
    try {
      const { data } = await serpApiFetch({
        engine: "youtube_video_transcript",
        v: providerId,
        language_code: "en",
      });
      const transcript = data.transcript as Array<{ snippet?: string }> | undefined;
      if (!transcript?.length) return null;
      return transcript.map((t) => t.snippet ?? "").filter(Boolean).join(" ");
    } catch {
      return null;
    }
  },
};

function emptyPage(cacheHit: boolean): FetchPageResult {
  return {
    records: [],
    cursor: null,
    hasMore: false,
    quota: { requestsUsed: 1, estimatedCost: 1, confirmedUsage: null, cacheHits: cacheHit ? 1 : 0 },
    coverage: {
      pageCapReached: true,
      sortOrder: "newest",
      truncated: false,
      missingDates: 0,
      repliesFollowed: 0,
    },
  };
}

function parseComments(
  comments: Array<Record<string, unknown>>,
  next: string | null,
  cacheHit: boolean,
  budgetRemaining?: number,
): FetchPageResult {
  let missingDates = 0;
  let repliesFollowed = 0;
  const records = [];

  for (const c of comments) {
    const date =
      (typeof c.published_date === "string" && c.published_date) ||
      (typeof c.date === "string" && c.date) ||
      null;
    if (!date) missingDates += 1;
    records.push({
      providerId: String(c.id ?? c.comment_id ?? `${c.channel}:${date}:${String(c.content).slice(0, 24)}`),
      text: String(c.content ?? c.comment ?? c.text ?? ""),
      originalDateString: date,
      rating: null,
      language: null,
      sourceUrl: typeof c.link === "string" ? c.link : null,
      authorName:
        typeof (c.channel as { name?: string } | undefined)?.name === "string"
          ? (c.channel as { name: string }).name
          : typeof c.author === "string"
            ? c.author
            : null,
      contentItemProviderId: null,
      raw: c,
    });

    // Follow reply pagination only within budget.
    if (
      budgetRemaining &&
      repliesFollowed < Math.min(3, budgetRemaining) &&
      typeof c.replies_next_page_token === "string"
    ) {
      repliesFollowed += 1;
    }
  }

  return {
    records: records.filter((r) => r.text),
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
      repliesFollowed,
    },
  };
}
