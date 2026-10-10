# Praise & Pain — setup

## Prerequisites

- Node.js 22+
- A Supabase project (Auth + Postgres)
- Vercel project for production
- Optional: SerpApi, TypeSafe/Jev, Inngest

**No demo or fabricated feedback is shipped.** Missing keys disable live features with explicit guidance.

## Environment variables

Copy `.env.example` to `.env.local`.

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Public | Canonical URL / redirects |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Browser auth (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Workers / privileged writes |
| `SERPAPI_API_KEY` | Server | Live Google Maps / App Store / Play / YouTube |
| `TYPESAFE_API_KEY` | Server | Jev classification |
| `TYPESAFE_MODEL` | Server | Default `jev-latest` |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Server | Background orchestration |
| `GENERATIVE_API_KEY` | Server | Optional emerging-topic proposals |

## Local development

```bash
npm install
cp .env.example .env.local
# fill credentials
npm run dev
```

In another terminal (when Inngest keys/dev server are available):

```bash
npm run workers
```

## Migrations

Apply `supabase/migrations/20261010000000_init.sql` in the Supabase SQL editor, or:

```bash
npx supabase db push
```

Configure Auth redirect URLs:

- `http://localhost:3000/auth/callback`
- `https://praiseandpain.site/auth/callback`
- Your Vercel preview URLs as needed

Use separate Supabase projects for development and production.

## First user path (no SerpApi required)

1. Sign up / sign in
2. Create a workspace
3. Register a primary entity (or skip discovery and create via import after a manual entity row)
4. Import CSV from Settings → mapping preview → import
5. With `TYPESAFE_API_KEY`, trigger sync/classification jobs via Inngest
6. Inspect feedback evidence, compare, create tasks, export reports

Without SerpApi, live discovery/collection stays disabled.
Without TypeSafe, classification stays skipped (status `skipped`) — metrics are not invented.

## Vercel

1. Import the GitHub repository
2. Set the same environment variables
3. Deploy
4. Point `praiseandpain.site` to the deployment
5. Register the Inngest app URL: `https://<host>/api/inngest`

## Health check

`GET /api/health` reports which integrations are configured without exposing secrets.

## Commands

```bash
npm run dev          # Next.js
npm run build        # production build
npm run start        # serve build
npm test             # vitest (fixture-backed analysis tests)
npm run typecheck    # tsc --noEmit
npm run workers      # Inngest dev
```

## Verification notes

- Unit tests use fixtures only (no external network).
- Live SerpApi / TypeSafe / Supabase checks require real credentials.
- CSV import is the supported path when live connectors are unconfigured.
