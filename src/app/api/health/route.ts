import { NextResponse } from "next/server";
import { serpApiConfigured } from "@/server/connectors";
import { jevConfigured } from "@/server/jev/client";
import { supabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "praise-and-pain",
    time: new Date().toISOString(),
    configured: {
      supabase: supabaseConfigured(),
      serpapi: serpApiConfigured(),
      jev: jevConfigured(),
      inngest: Boolean(process.env.INNGEST_EVENT_KEY),
    },
  });
}
