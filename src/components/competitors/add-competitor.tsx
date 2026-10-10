"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

const sources = [
  { id: "google_maps", label: "Google Maps" },
  { id: "apple_app_store", label: "Apple App Store" },
  { id: "google_play", label: "Google Play" },
  { id: "youtube", label: "YouTube" },
] as const;

export function AddCompetitor({
  workspaceId,
  kind,
  remaining,
  canEdit,
}: {
  workspaceId: string;
  kind: string;
  remaining: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<(typeof sources)[number]["id"]>("google_maps");
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function discover(event: FormEvent) {
    event.preventDefault();
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
      setResults([]);
      setMessage(json.message ?? json.error ?? "Search failed");
      return;
    }
    setResults(json.results ?? []);
    if (!(json.results ?? []).length) setMessage("No matches. Try a more specific name.");
  }

  async function confirm(item: DiscoveryResult) {
    setSavingId(item.providerId);
    setMessage(null);
    const res = await fetch(`/api/workspaces/${workspaceId}/entities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        source: item.source,
        providerId: item.providerId,
        name: item.name,
        kind,
        role: "competitor",
        url: item.url,
        metadata: {
          location: item.location,
          platformIdentifiers: item.platformIdentifiers,
          channelOrAppLinks: item.channelOrAppLinks,
        },
      }),
    });
    const json = await res.json();
    setSavingId(null);
    if (!res.ok) {
      setMessage(json.error ?? "Could not add that competitor");
      return;
    }
    setMessage(`${item.name} added. Sync from Overview to pull their newest reviews.`);
    setResults([]);
    setQuery("");
    setOpen(false);
    router.refresh();
  }

  if (!canEdit) return null;
  if (remaining <= 0) {
    return (
      <p className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-ink-muted)]">
        3 of 3 competitors are in. Remove one in Settings before adding another.
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl">Add a competitor</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            {remaining} of 3 slots open. Search uses live SerpApi results, then you confirm the match.
          </p>
        </div>
        <Button type="button" variant={open ? "secondary" : "default"} onClick={() => setOpen((value) => !value)}>
          {open ? "Close" : "Add competitor"}
        </Button>
      </div>
      {open ? (
        <form onSubmit={discover} className="mt-4 flex flex-wrap gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Competitor name"
            className="max-w-sm"
            required
          />
          <select
            className="h-10 rounded-md border border-[var(--color-border)] bg-white px-3 text-sm"
            value={source}
            onChange={(event) => setSource(event.target.value as (typeof sources)[number]["id"])}
          >
            {sources.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </Button>
        </form>
      ) : null}
      {message ? <p className="mt-3 text-sm text-[var(--color-ink)]">{message}</p> : null}
      <ul className="mt-4 space-y-3">
        {results.map((item) => (
          <li key={`${item.source}:${item.providerId}`} className="rounded-lg border border-[var(--color-border)] px-4 py-3">
            <p className="font-semibold">{item.name}</p>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
              {item.location ? `${item.location} · ` : ""}
              {item.providerId}
            </p>
            {item.snippet ? <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{item.snippet}</p> : null}
            <Button
              className="mt-3"
              size="sm"
              disabled={savingId === item.providerId}
              onClick={() => confirm(item)}
            >
              {savingId === item.providerId ? "Adding…" : "Add as competitor"}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
