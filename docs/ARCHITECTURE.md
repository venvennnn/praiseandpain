# Architecture

## Boundaries

- **Browser:** rendering, filters, navigation, interaction. No provider secrets, no authoritative scoring.
- **Server routes:** auth, Zod validation, membership checks, job submission (HTTP 202 + run id).
- **Workers (Inngest):** collect → normalise → classify → aggregate → compare → alert → summarise.
- **PostgreSQL (Supabase):** tenant data, workflow state, versioned classifications and snapshots.

## Layout

```
src/app                 # App Router pages + API
src/components          # UI
src/server/connectors   # SerpApi adapters
src/server/analysis     # Pure metrics / dates / text
src/server/jev          # TypeSafe classification
src/server/jobs         # Inngest pipeline
src/server/repositories # Persistence helpers
src/shared/schemas      # Zod contracts (MetricResult, ComparisonResult, …)
supabase/migrations     # Schema + RLS
```

## Metric contracts

Frontend components consume `MetricResult` / `ComparisonResult` from `@/shared/schemas/metrics` and never recompute statistical conclusions.

Formula versions (`metrics.v1`, `comparison.v1`, `priority.v1`) are persisted on snapshots so threshold changes do not silently rewrite history.

## Example calculation (fixture)

See `src/server/analysis/metrics.test.ts`:

- N = 100 eligible classified feedback
- M = 40 mention `wait_time`
- C = 10 aspect-negative (including mixed)
- P = 25 aspect-positive (including mixed)
- Prevalence = 40/100 = 40%
- Complaint share = 10/40 = 25% with Beta(1+C, 1+M−C) 95% CI
- Praise share = 25/40 = 62.5% (shares need not sum to 100%)

## Tenant safety

- RLS on all workspace tables
- `requireMembership` on every mutating API
- Workers validate `collection_runs.workspace_id`
- Cache keys include workspace + text hash + model + schema + taxonomy version
- Soft-delete workspace cancels queued/running jobs

## Connectors

See `docs/CONNECTORS.md`.
