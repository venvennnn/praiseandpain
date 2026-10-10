/**
 * Production requirements for Praise & Pain.
 * SerpApi is the primary feedback collection path — not optional.
 * TypeSafe/Jev is required for real classification.
 * Supabase is required for auth and persistence.
 * Nothing fabricates feedback or substitutes fake data when these are missing.
 */

export type IntegrationStatus = {
  supabase: boolean;
  serpapi: boolean;
  jev: boolean;
  inngest: boolean;
};

export function integrationStatus(): IntegrationStatus {
  return {
    supabase: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    serpapi: Boolean(process.env.SERPAPI_API_KEY),
    jev: Boolean(process.env.TYPESAFE_API_KEY),
    inngest: Boolean(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY),
  };
}

export function requiredIntegrationsReady(): boolean {
  const s = integrationStatus();
  return s.supabase && s.serpapi && s.jev && s.inngest;
}

export function missingRequiredIntegrations(): string[] {
  const s = integrationStatus();
  const missing: string[] = [];
  if (!s.supabase) missing.push("Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)");
  if (!s.serpapi) missing.push("SerpApi (SERPAPI_API_KEY) — required for live Maps / App Store / Play / YouTube collection");
  if (!s.jev) missing.push("TypeSafe/Jev (TYPESAFE_API_KEY) — required for real classification");
  if (!s.inngest) missing.push("Inngest (INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY) — required for collection pipeline");
  return missing;
}

export class MissingRequiredConfigError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super(
      `Required configuration missing: ${missing.join("; ")}. Praise & Pain does not invent feedback or run fake algorithms.`,
    );
    this.name = "MissingRequiredConfigError";
    this.missing = missing;
  }
}

export function assertSerpApiConfigured() {
  if (!process.env.SERPAPI_API_KEY) {
    throw new MissingRequiredConfigError([
      "SerpApi (SERPAPI_API_KEY) — required for live Maps / App Store / Play / YouTube collection",
    ]);
  }
}

export function assertJevConfigured() {
  if (!process.env.TYPESAFE_API_KEY) {
    throw new MissingRequiredConfigError([
      "TypeSafe/Jev (TYPESAFE_API_KEY) — required for real classification",
    ]);
  }
}

export function assertCollectionStackConfigured() {
  const missing = missingRequiredIntegrations().filter(
    (m) => m.startsWith("SerpApi") || m.startsWith("TypeSafe") || m.startsWith("Inngest"),
  );
  if (missing.length) throw new MissingRequiredConfigError(missing);
}
