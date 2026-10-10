import { nanoid } from "nanoid";

const SERPAPI_BASE = "https://serpapi.com/search.json";

export class ConnectorConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectorConfigError";
  }
}

export class ConnectorSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectorSchemaError";
  }
}

export function requireSerpApiKey(): string {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) {
    throw new ConnectorConfigError(
      "SERPAPI_API_KEY is not configured. Live collection is disabled. Add the key in environment settings, or import feedback via CSV/JSON.",
    );
  }
  return key;
}

export function serpApiConfigured(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY);
}

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/api_key=[^&\s]+/gi, "api_key=REDACTED");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = /api[_-]?key|secret|token|authorization/i.test(k)
        ? "REDACTED"
        : redact(v);
    }
    return out;
  }
  return value;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function serpApiFetch(
  params: Record<string, string | number | boolean | undefined>,
  opts?: { timeoutMs?: number; retries?: number },
): Promise<{ data: Record<string, unknown>; correlationId: string; cacheHit: boolean }> {
  const apiKey = requireSerpApiKey();
  const correlationId = nanoid();
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const retries = opts?.retries ?? 3;

  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    search.set(k, String(v));
  }
  search.set("api_key", apiKey);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${SERPAPI_BASE}?${search.toString()}`, {
        signal: controller.signal,
        headers: { "X-Correlation-Id": correlationId },
      });
      clearTimeout(timer);

      if (res.status === 401 || res.status === 403) {
        throw new ConnectorConfigError("SerpApi credentials are invalid.");
      }
      if (res.status === 429 || res.status >= 500) {
        const jitter = 200 + Math.floor(Math.random() * 400) * (attempt + 1);
        await sleep(jitter);
        lastError = new Error(`SerpApi transient ${res.status}`);
        continue;
      }
      if (!res.ok) {
        throw new ConnectorSchemaError(`SerpApi HTTP ${res.status}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      if (data.error && typeof data.error === "string") {
        if (/invalid api key/i.test(data.error)) {
          throw new ConnectorConfigError(data.error);
        }
        throw new ConnectorSchemaError(data.error);
      }
      const searchMeta = data.search_metadata as Record<string, unknown> | undefined;
      const cacheHit = searchMeta?.status === "Cache";
      console.info(
        JSON.stringify({
          msg: "serpapi_call",
          correlationId,
          engine: params.engine,
          cacheHit,
          // never log api key
          params: redact({ ...params }),
        }),
      );
      return { data, correlationId, cacheHit: Boolean(cacheHit) };
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ConnectorConfigError || err instanceof ConnectorSchemaError) {
        throw err;
      }
      lastError = err;
      const jitter = 200 + Math.floor(Math.random() * 400) * (attempt + 1);
      await sleep(jitter);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("SerpApi request failed");
}
