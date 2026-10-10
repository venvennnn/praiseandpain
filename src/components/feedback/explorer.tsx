"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Evidence = {
  id: string;
  excerpt: string;
  aspect_key: string | null;
  sentiment: string | null;
  start_offset: number;
  end_offset: number;
};

type Classification = {
  id: string;
  status: string;
  is_praise: boolean | null;
  is_complaint: boolean | null;
  aspects: Array<{ key: string; sentiment: string }>;
  evidence_spans: Evidence[];
};

type FeedbackItem = {
  id: string;
  original_text: string;
  published_at: string | null;
  source: string;
  rating: number | null;
  source_url: string | null;
  author_name: string | null;
  entity_id: string;
  classifications: Classification[] | Classification | null;
};

export function FeedbackExplorer({
  workspaceId,
  initialItems,
  entities,
  filters,
}: {
  workspaceId: string;
  initialItems: FeedbackItem[];
  entities: Array<{ id: string; name: string; source: string }>;
  filters: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q ?? "");
  const [selected, setSelected] = useState<FeedbackItem | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const entityName = useMemo(() => {
    const map = new Map(entities.map((e) => [e.id, e.name]));
    return (id: string) => map.get(id) ?? id.slice(0, 8);
  }, [entities]);

  function applyFilters(next: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    router.push(`/w/${workspaceId}/feedback?${params.toString()}`);
  }

  async function submitCorrection(field: string, newValue: unknown) {
    if (!selected) return;
    const classification = Array.isArray(selected.classifications)
      ? selected.classifications[0]
      : selected.classifications;
    if (!classification) {
      setMessage("No classification to correct yet.");
      return;
    }
    setCorrecting(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/corrections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        classificationId: classification.id,
        feedbackId: selected.id,
        field,
        previousValue: classification.aspects,
        newValue,
      }),
    });
    setCorrecting(false);
    if (!res.ok) {
      const json = await res.json();
      setMessage(json.error ?? "Correction failed");
      return;
    }
    setMessage("Correction saved as a versioned override.");
    router.refresh();
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters({ ...filters, q });
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search feedback"
            className="max-w-sm"
          />
          <select
            className="h-10 rounded-md border border-[var(--color-border)] bg-white px-3 text-sm"
            value={filters.source ?? ""}
            onChange={(e) =>
              applyFilters({ ...filters, source: e.target.value || undefined })
            }
          >
            <option value="">All sources</option>
            <option value="google_maps">Google Maps</option>
            <option value="apple_app_store">Apple App Store</option>
            <option value="google_play">Google Play</option>
            <option value="youtube">YouTube</option>
            <option value="csv_import">CSV import</option>
            <option value="json_import">JSON import</option>
          </select>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </form>

        <ul className="mt-6 divide-y divide-[var(--color-border)]">
          {initialItems.length === 0 ? (
            <li className="py-8 text-sm text-[var(--color-ink-muted)]">
              No feedback collected yet. Import a file or configure live connectors.
            </li>
          ) : (
            initialItems.map((item) => {
              const classification = Array.isArray(item.classifications)
                ? item.classifications[0]
                : item.classifications;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="w-full py-4 text-left hover:bg-[var(--color-surface-muted)]"
                    onClick={() => {
                      setSelected(item);
                      setMessage(null);
                    }}
                  >
                    <div className="flex flex-wrap gap-2 text-xs text-[var(--color-ink-muted)]">
                      <span>{item.source}</span>
                      <span>{entityName(item.entity_id)}</span>
                      <span>
                        {item.published_at
                          ? new Date(item.published_at).toLocaleDateString()
                          : "Undated"}
                      </span>
                      {classification?.is_praise ? (
                        <span className="text-[var(--color-praise)]">Praise</span>
                      ) : null}
                      {classification?.is_complaint ? (
                        <span className="text-[var(--color-pain)]">Pain</span>
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-[var(--color-ink)]">
                      {item.original_text}
                    </p>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <aside className="border border-[var(--color-border)] bg-white p-4">
        {selected ? (
          <div className="space-y-4">
            <h2 className="font-[family-name:var(--font-display)] text-xl">Evidence</h2>
            <p className="whitespace-pre-wrap text-sm">{selected.original_text}</p>
            {selected.source_url ? (
              <a
                href={selected.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[var(--color-action)]"
              >
                Open source
              </a>
            ) : null}
            {(() => {
              const classification = Array.isArray(selected.classifications)
                ? selected.classifications[0]
                : selected.classifications;
              const spans = classification?.evidence_spans ?? [];
              return (
                <>
                  <div className="text-sm text-[var(--color-ink-muted)]">
                    Status: {classification?.status ?? "unclassified"}
                  </div>
                  <ul className="space-y-2">
                    {spans.map((span) => (
                      <li
                        key={span.id}
                        className="border-l-2 border-[var(--color-action)] pl-3 text-sm"
                      >
                        “{span.excerpt}”
                        <div className="text-xs text-[var(--color-ink-muted)]">
                          {span.aspect_key} · {span.sentiment}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="praise"
                      disabled={correcting || !classification}
                      onClick={() =>
                        submitCorrection("aspects", [
                          { key: "manual_praise", sentiment: "positive", unmatched: false },
                        ])
                      }
                    >
                      Mark praise aspect
                    </Button>
                    <Button
                      size="sm"
                      variant="pain"
                      disabled={correcting || !classification}
                      onClick={() =>
                        submitCorrection("aspects", [
                          { key: "manual_pain", sentiment: "negative", unmatched: false },
                        ])
                      }
                    >
                      Mark pain aspect
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!selected}
                      onClick={async () => {
                        const res = await fetch(`/api/workspaces/${workspaceId}/tasks`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            workspaceId,
                            title: `Follow up: ${selected.original_text.slice(0, 60)}`,
                            evidenceFeedbackIds: [selected.id],
                            entityId: selected.entity_id,
                          }),
                        });
                        if (res.ok) {
                          setMessage("Task created and linked to this feedback.");
                          router.refresh();
                        }
                      }}
                    >
                      Create task
                    </Button>
                  </div>
                </>
              );
            })()}
            {message ? <p className="text-sm text-[var(--color-ink-muted)]">{message}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Select feedback to inspect evidence and corrections.
          </p>
        )}
      </aside>
    </div>
  );
}
