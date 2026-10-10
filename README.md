# Praise & Pain

**Know what they love. Fix what they don’t.**

Feedback intelligence for businesses, app developers, and creators.  
Homepage: [praiseandpain.site](https://praiseandpain.site) — “Their feedback. Your next move.”

## Stack

Next.js App Router · TypeScript · Tailwind · Supabase Auth/Postgres · Inngest · Recharts · TypeSafe/Jev · SerpApi

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

See [docs/SETUP.md](./docs/SETUP.md), [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), and [PROGRESS.md](./PROGRESS.md).

## Working features without live provider keys

- Marketing site and authenticated shell (needs Supabase)
- Workspace onboarding and settings
- CSV/JSON import with validation
- Tasks, interventions recording, CSV/HTML exports
- Pure metric/comparison libraries (tested with fixtures)

Live review collection and Jev classification activate only when their keys are configured. The app never fabricates feedback or silently substitutes demo data.
