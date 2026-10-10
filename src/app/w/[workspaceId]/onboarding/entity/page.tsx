"use client";

import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DiscoveryResult = {
  providerId: string;
  name: string;
  source: string;
  url?: string;
  location?: string;
  platformIdentifiers?: Record<string, string>;
  channelOrAppLinks?: string[];
  snippet?: string;
};

const sourcesByHint = [
  { id: "google_maps", label: "Google Maps" },
  { id: "apple_app_store", label: "Apple App Store" },
  { id: "google_play", label: "Google Play" },
  { id: "youtube", label: "YouTube" },
] as const;

export default function EntityOnboardingPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<(typeof sourcesByHint)[number]["id"]>("google_maps");
  const [kind, setKind] = useState<"business" | "app" | "creator">("business");
  const [role, setRole] = useState<"primary" | "competitor">("primary");
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function discover(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, source, kind }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(json.message ?? json.error ?? "Discovery unavailable");
      setResults([]);
      return;
    }
    setResults(json.results ?? []);
    if (!(json.results ?? []).length) {
      setMessage("No matches. Check the query or import feedback manually.");
    }
  }

  async function register(item: DiscoveryResult) {
    const res = await fetch(`/api/workspaces/${workspaceId}/entities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        source: item.source,
        providerId: item.providerId,
        name: item.name,
        kind,
        role,
        url: item.url,
        metadata: {
          location: item.location,
          platformIdentifiers: item.platformIdentifiers,
          channelOrAppLinks: item.channelOrAppLinks,
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error ?? "Could not register entity");
      return;
    }
    setMessage(`Registered ${item.name} as ${role}.`);
    if (role === "primary") setRole("competitor");
  }

  return (
    <div className="hero-atmosphere min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <BrandMark className="text-3xl font-semibold" />
        <h1 className="mt-10 font-[family-name:var(--font-display)] text-4xl">
          Confirm your entity
        </h1>
        <p className="mt-3 text-[var(--color-ink-muted)]">
          Discovery runs through SerpApi against real Google Maps, App Store, Google Play, and
          YouTube results. Location, platform IDs, and channel/app links are shown to prevent
          mistaken matches. Start with one primary entity and up to three competitors.
        </p>

        <form onSubmit={discover} className="mt-8 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="query">Search</Label>
              <Input
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                required
                placeholder="Name, app, or channel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <select
                id="source"
                className="h-10 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-sm"
                value={source}
                onChange={(e) =>
                  setSource(e.target.value as (typeof sourcesByHint)[number]["id"])
                }
              >
                {sourcesByHint.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              className="h-10 rounded-md border border-[var(--color-border)] bg-white px-3 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="business">Business</option>
              <option value="app">App</option>
              <option value="creator">Creator</option>
            </select>
            <select
              className="h-10 rounded-md border border-[var(--color-border)] bg-white px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
            >
              <option value="primary">Primary</option>
              <option value="competitor">Competitor</option>
            </select>
            <Button type="submit" disabled={loading}>
              {loading ? "Searching…" : "Discover"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/w/${workspaceId}/overview`)}
            >
              Skip to workspace
            </Button>
          </div>
        </form>

        {message ? <p className="mt-4 text-sm text-[var(--color-ink-muted)]">{message}</p> : null}

        <ul className="mt-8 space-y-4">
          {results.map((item) => (
            <li
              key={`${item.source}:${item.providerId}`}
              className="border border-[var(--color-border)] bg-white p-4"
            >
              <div className="font-semibold">{item.name}</div>
              <div className="mt-1 text-sm text-[var(--color-ink-muted)]">
                {item.location ? `Location: ${item.location} · ` : null}
                ID: {item.providerId}
              </div>
              {item.channelOrAppLinks?.length ? (
                <div className="mt-1 text-sm">
                  Links:{" "}
                  {item.channelOrAppLinks.map((link) => (
                    <a
                      key={link}
                      href={link}
                      className="mr-2 text-[var(--color-action)]"
                      target="_blank"
                      rel="noreferrer"
                    >
                      open
                    </a>
                  ))}
                </div>
              ) : null}
              {item.snippet ? (
                <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{item.snippet}</p>
              ) : null}
              <Button className="mt-3" size="sm" onClick={() => register(item)}>
                Confirm as {role}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
