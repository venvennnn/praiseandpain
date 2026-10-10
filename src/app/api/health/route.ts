import { NextResponse } from "next/server";
import {
  integrationStatus,
  missingRequiredIntegrations,
  requiredIntegrationsReady,
} from "@/server/config/requirements";

export async function GET() {
  const configured = integrationStatus();
  const missing = missingRequiredIntegrations();
  const ready = requiredIntegrationsReady();
  return NextResponse.json({
    ok: true,
    service: "praise-and-pain",
    time: new Date().toISOString(),
    ready,
    configured,
    missing,
    note: ready
      ? "All required integrations configured for live collection and classification."
      : "SerpApi, TypeSafe/Jev, Supabase, and Inngest are required. No fake data is substituted.",
  });
}
