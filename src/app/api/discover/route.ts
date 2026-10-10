import { NextResponse } from "next/server";
import { DiscoverEntitySchema } from "@/shared/schemas/domain";
import { requireUser, AuthError } from "@/server/auth/permissions";
import { getConnector, serpApiConfigured } from "@/server/connectors";
import { ConnectorConfigError } from "@/server/connectors/serpapi";

export async function POST(request: Request) {
  try {
    await requireUser();
    const body = DiscoverEntitySchema.parse(await request.json());

    if (body.source === "csv_import" || body.source === "json_import") {
      return NextResponse.json({
        results: [],
        error: "Use the import endpoint for CSV/JSON",
      }, { status: 400 });
    }

    if (!serpApiConfigured()) {
      return NextResponse.json(
        {
          results: [],
          disabled: true,
          message:
            "SERPAPI_API_KEY is not configured. Live discovery is disabled. Import feedback via CSV/JSON instead.",
        },
        { status: 503 },
      );
    }

    const connector = getConnector(body.source);
    const results = await connector.discover(body.query, {
      language: body.language ?? "en",
      region: body.region ?? "us",
    });
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof ConnectorConfigError) {
      return NextResponse.json({ error: err.message, disabled: true }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Discovery failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
