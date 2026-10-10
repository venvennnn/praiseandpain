"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SyncButton({
  workspaceId,
  serpapiReady,
  jevReady,
  inngestReady,
}: {
  workspaceId: string;
  serpapiReady: boolean;
  jevReady: boolean;
  inngestReady: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ready = serpapiReady && jevReady && inngestReady;

  async function sync() {
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/workspaces/${workspaceId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, forceFull: false }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      const detail =
        typeof json.error === "string"
          ? json.error
          : Array.isArray(json.missing)
            ? json.missing.join("; ")
            : "Sync failed";
      setMessage(detail);
      return;
    }
    setMessage(`Sync queued (run ${json.runId}). Collecting real SerpApi feedback…`);
    router.refresh();
  }

  if (!ready) {
    const gaps = [
      !serpapiReady ? "SERPAPI_API_KEY" : null,
      !jevReady ? "TYPESAFE_API_KEY" : null,
      !inngestReady ? "INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY" : null,
    ].filter(Boolean);
    return (
      <div className="text-right">
        <Button disabled title={`Required: ${gaps.join(", ")}`}>
          Sync blocked
        </Button>
        <p className="mt-2 max-w-xs text-xs text-[var(--color-pain)]">
          Required for live sync: {gaps.join(", ")}. No fabricated reviews.
        </p>
      </div>
    );
  }

  return (
    <div className="text-right">
      <Button onClick={sync} disabled={loading}>
        {loading ? "Queueing…" : "Sync live feedback"}
      </Button>
      {message ? (
        <p className="mt-2 max-w-xs text-xs text-[var(--color-ink-muted)]">{message}</p>
      ) : null}
    </div>
  );
}
