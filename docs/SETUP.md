# Praise & Pain — setup

## Required stack (not optional)

Praise & Pain is a **live feedback intelligence** product. These are all required:

| Integration | Env vars | Role |
| --- | --- | --- |
| **SerpApi** | `SERPAPI_API_KEY` | **Primary collection** — real Google Maps reviews, Apple App Store reviews, Google Play reviews, YouTube comments (+ transcripts when available) |
| **TypeSafe/Jev** | `TYPESAFE_API_KEY`, `TYPESAFE_MODEL` | **Real classification** — praise/pain/aspects/evidence |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Auth, Postgres, RLS |
| **Inngest** | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Durable collect → classify → aggregate pipeline |

The app **does not invent reviews, substitute demo data, or fake algorithm outputs** when keys are missing. Sync and discovery return HTTP 503 with the missing requirement listed.

CSV/JSON import exists only as a secondary path for customer-owned files with provenance — it is not a replacement for SerpApi.

## Local development

```bash
npm install
cp .env.example .env.local
# fill ALL required keys above
npm run dev
```

In another terminal:

```bash
npm run workers
```

## Migrations

Apply these SQL files in the Supabase SQL editor, in order:

- `supabase/migrations/20261010000000_init.sql`
- `supabase/migrations/20261010090000_fix_workspace_rls.sql`
- `supabase/migrations/20261010093000_fix_entities_rls.sql`
- `supabase/migrations/20261010110000_workspace_plan.sql` (base = newest 200 reviews per place, pro = 2,000)

Or:

```bash
npx supabase db push
```

### Auth URLs (important — fixes localhost / otp_expired)

In Supabase → **Authentication → URL Configuration**:

1. **Site URL** = `https://praiseandpain.site` (not localhost once you are live)
2. **Redirect URLs** (add all of these):
   - `https://praiseandpain.site/auth/callback`
   - `https://praiseandpain.site/**`
   - `http://localhost:3000/auth/callback` (local only)

If Site URL stays `http://localhost:3000`, expired confirmation emails send users to localhost with `otp_expired`.

After changing Site URL, request a **new** confirmation email (old links stay invalid).

Use separate Supabase projects for development and production.

## First live user path

1. Sign up / sign in (Supabase Auth)
2. Create a workspace
3. Discover and confirm your entity via SerpApi
4. Add up to three competitors the same way
5. Click **Sync live feedback** — SerpApi collects, Jev classifies, metrics publish
6. Inspect evidence, compare, create tasks, export reports

## Vercel

1. Import the GitHub repository
2. Set every required env var (SerpApi included)
3. Deploy and point `praiseandpain.site`
4. Register Inngest: `https://<host>/api/inngest`

## Health

`GET /api/health` reports `ready` and `missing` without exposing secrets. `ready: true` only when Supabase, SerpApi, Jev, and Inngest are all configured.

## Commands

```bash
npm run dev
npm run build
npm run start
npm test              # fixture-backed analysis math only
npm run typecheck
npm run workers
```

Live SerpApi / TypeSafe / Supabase checks require the real credentials above.
