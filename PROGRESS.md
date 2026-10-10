# Implementation progress

## Completed

- [x] Next.js App Router + TypeScript + Tailwind design tokens (white / charcoal / teal / coral / indigo)
- [x] Landing, auth (email/password via Supabase), onboarding, workspace shell
- [x] Routes: overview, feedback, competitors, tasks, creator backlog, reports, settings
- [x] Supabase migration with tenant tables + RLS
- [x] Zod API contracts; sync returns 202 + run id
- [x] SerpApi connectors: Google Maps, Apple App Store, Google Play, YouTube (+ transcript helper)
- [x] CSV/JSON import with preview, limits, provenance, duplicates
- [x] Inngest pipeline stages with idempotency / checkpoints
- [x] TypeSafe/Jev classification integration (skips cleanly if unconfigured)
- [x] MetricResult / ComparisonResult + Beta intervals + priority scoring
- [x] Tasks, interventions, exports, workspace deletion
- [x] Fixture tests for metrics/dates/CSV safety
- [x] Setup / architecture / connector docs + `.env.example`

## Explicitly not included (per product owner)

- [x] No demo workspace / fabricated feedback data
- [x] SerpApi treated as **required** primary collection (not optional)
- [x] Sync/discovery fail hard with 503 when SerpApi / Jev / Inngest missing

## External blockers (must configure for live product)

- **SERPAPI_API_KEY** — primary path for real Maps / App Store / Play / YouTube data
- **TYPESAFE_API_KEY** — real classification
- Supabase project + migrations + Auth redirects
- Inngest keys + `/api/inngest` registration
- Vercel + `praiseandpain.site` DNS
- Stitch design exports were not present in the repository; UI follows the written visual system

## Changing thresholds

Update workspace columns `comparison_min_mentions`, `comparison_practical_diff`, `comparison_posterior_threshold`. New snapshots store formula versions; historical active snapshots are not rewritten in place when thresholds change — re-run aggregation to publish a new snapshot.
