import { z } from "zod";

export const WorkspaceKindSchema = z.enum(["business", "app", "creator"]);
export type WorkspaceKind = z.infer<typeof WorkspaceKindSchema>;

export const MemberRoleSchema = z.enum(["owner", "editor", "viewer"]);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const SourceTypeSchema = z.enum([
  "google_maps",
  "apple_app_store",
  "google_play",
  "youtube",
  "csv_import",
  "json_import",
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const FeedbackDatePrecisionSchema = z.enum([
  "exact",
  "day",
  "month",
  "relative",
  "unknown",
]);

export const CollectionRunStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const RunStageSchema = z.enum([
  "discover",
  "collect",
  "normalise",
  "classify",
  "aggregate",
  "compare",
  "alert",
  "summarise",
]);

export const TaskStatusSchema = z.enum([
  "needs_attention",
  "in_progress",
  "monitoring",
  "closed",
]);

export const IdeaStatusSchema = z.enum(["considering", "planned", "published"]);

export const InterventionOutcomeSchema = z.enum([
  "improvement_observed",
  "deterioration_observed",
  "no_clear_change",
  "insufficient_data",
  "pending",
]);

export const DiscoverEntitySchema = z.object({
  query: z.string().min(1).max(500),
  source: SourceTypeSchema,
  kind: WorkspaceKindSchema,
  region: z.string().optional(),
  language: z.string().optional(),
});

export const RegisterEntitySchema = z.object({
  workspaceId: z.string().uuid(),
  source: SourceTypeSchema,
  providerId: z.string().min(1),
  name: z.string().min(1).max(500),
  kind: WorkspaceKindSchema,
  role: z.enum(["primary", "competitor"]),
  metadata: z.record(z.unknown()).default({}),
  url: z.string().url().optional(),
});

export const SyncRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  // Empty means "sync all workspace entities" — server fills this in.
  entityIds: z.array(z.string().uuid()).max(4).default([]),
  forceFull: z.boolean().optional().default(false),
});

export const FeedbackListQuerySchema = z.object({
  workspaceId: z.string().uuid(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().optional(),
  topicId: z.string().uuid().optional(),
  source: SourceTypeSchema.optional(),
  entityId: z.string().uuid().optional(),
  sentiment: z.enum(["praise", "pain", "mixed", "neutral"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const CreateTaskSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  aspectId: z.string().uuid().optional(),
  entityId: z.string().uuid().optional(),
  priority: z.number().min(0).max(1).optional(),
  effort: z.number().min(0).max(1).optional(),
  dueDate: z.string().datetime().optional(),
  evidenceFeedbackIds: z.array(z.string().uuid()).default([]),
  recurring: z.boolean().default(false),
});

export const CreateInterventionSchema = z.object({
  workspaceId: z.string().uuid(),
  description: z.string().min(1).max(2000),
  entityId: z.string().uuid(),
  aspectIds: z.array(z.string().uuid()).min(1),
  implementedAt: z.string().datetime(),
  washoutDays: z.number().int().min(0).max(30).default(0),
  windowDays: z.number().int().min(7).max(90).default(28),
});

export const CorrectionSchema = z.object({
  workspaceId: z.string().uuid(),
  classificationId: z.string().uuid(),
  feedbackId: z.string().uuid(),
  field: z.string().min(1),
  previousValue: z.unknown(),
  newValue: z.unknown(),
  note: z.string().max(2000).optional(),
});

export const OnboardingSchema = z.object({
  name: z.string().min(1).max(120),
  kind: WorkspaceKindSchema,
  timezone: z.string().default("UTC"),
  language: z.string().default("en"),
  analysisWindowDays: z.number().int().min(7).max(365).default(90),
  refreshCadenceHours: z.number().int().min(6).max(168).default(24),
  retrievalBudget: z.number().int().min(10).max(5000).default(200),
});

export const ImportMappingSchema = z.object({
  text: z.string().min(1),
  providerId: z.string().optional(),
  publishedAt: z.string().optional(),
  rating: z.string().optional(),
  language: z.string().optional(),
  sourceUrl: z.string().optional(),
  author: z.string().optional(),
});
