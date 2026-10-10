import { z } from "zod";
import type { SourceType } from "@/shared/schemas/domain";

export const DiscoveredEntitySchema = z.object({
  providerId: z.string(),
  name: z.string(),
  source: z.string(),
  url: z.string().optional(),
  location: z.string().optional(),
  platformIdentifiers: z.record(z.string()).default({}),
  channelOrAppLinks: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
  snippet: z.string().optional(),
});

export type DiscoveredEntity = z.infer<typeof DiscoveredEntitySchema>;

export const FeedbackRecordSchema = z.object({
  providerId: z.string(),
  text: z.string(),
  originalDateString: z.string().nullable(),
  rating: z.number().nullable(),
  language: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  authorName: z.string().nullable(),
  contentItemProviderId: z.string().nullable().optional(),
  raw: z.unknown().optional(),
});

export type FeedbackRecord = z.infer<typeof FeedbackRecordSchema>;

export const QuotaMetaSchema = z.object({
  requestsUsed: z.number().int().nonnegative(),
  estimatedCost: z.number().nonnegative(),
  confirmedUsage: z.number().nullable(),
  cacheHits: z.number().int().nonnegative().default(0),
});

export const CoverageInfoSchema = z.object({
  pageCapReached: z.boolean().default(false),
  sortOrder: z.string().nullable().default(null),
  truncated: z.boolean().default(false),
  missingDates: z.number().int().nonnegative().default(0),
  repliesFollowed: z.number().int().nonnegative().default(0),
});

export const FetchPageResultSchema = z.object({
  records: z.array(FeedbackRecordSchema),
  cursor: z.unknown().nullable(),
  quota: QuotaMetaSchema,
  coverage: CoverageInfoSchema,
  hasMore: z.boolean(),
});

export type FetchPageResult = z.infer<typeof FetchPageResultSchema>;

export type ConnectorAdapter = {
  source: SourceType;
  discover: (query: string, opts?: Record<string, string>) => Promise<DiscoveredEntity[]>;
  fetchDetails: (providerId: string) => Promise<DiscoveredEntity>;
  fetchFeedbackPage: (
    providerId: string,
    cursor: unknown | null,
    opts?: { sort?: string; budgetRemaining?: number },
  ) => Promise<FetchPageResult>;
  fetchTranscript?: (providerId: string) => Promise<string | null>;
  capabilities: {
    chronologicalSort: boolean;
    pagination: "next_page_token" | "page" | "none";
    transcripts: boolean;
    requiresSeparateMetaRequest: boolean;
  };
};
