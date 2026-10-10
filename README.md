# Praise & Pain

**Know what they love. Fix what they don’t.**

Live feedback intelligence for businesses, app developers, and creators.  
Collects **real** reviews and comments through **SerpApi**, classifies them with **TypeSafe/Jev**, and turns evidence into next moves.

Homepage: [praiseandpain.site](https://praiseandpain.site) — “Their feedback. Your next move.”

## Required integrations

- **SerpApi** — primary collection (Google Maps, App Store, Google Play, YouTube)
- **TypeSafe/Jev** — real classification algorithms
- **Supabase** — auth + Postgres + RLS
- **Inngest** — durable sync pipeline

No demo workspace. No fabricated feedback. Missing keys block sync with an explicit error.

## Quick start

```bash
npm install
cp .env.example .env.local   # SerpApi key is REQUIRED
npm run dev
npm run workers              # separate terminal
```

See [docs/SETUP.md](./docs/SETUP.md), [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), [docs/CONNECTORS.md](./docs/CONNECTORS.md).
