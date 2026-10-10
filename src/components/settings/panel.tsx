"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsPanel({
  workspaceId,
  workspace,
  role,
  providerStatus,
  entities,
  members,
}: {
  workspaceId: string;
  workspace: {
    id: string;
    name: string;
    timezone: string;
    retrieval_budget?: number;
    usage_consumed?: number;
    usage_limit?: number;
    retention_days?: number;
  };
  role: string;
  providerStatus: { serpapi: boolean; jev: boolean };
  entities: Array<{
    role: string;
    entity: {
      id: string;
      name: string;
      source: string;
      provider_id: string;
      url: string | null;
      metadata: Record<string, unknown>;
    };
  }>;
  members: Array<{ id: string; role: string; user_id: string }>;
}) {
  const router = useRouter();
  const [csv, setCsv] = useState("text,date,rating\nGreat coffee,2024-01-02,5\nSlow service,2024-01-03,2\n");
  const [entityId, setEntityId] = useState(entities[0]?.entity.id ?? "");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  async function dryRunImport() {
    const res = await fetch(`/api/workspaces/${workspaceId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityId,
        format: "csv",
        mapping: { text: "text", publishedAt: "date", rating: "rating" },
        content: csv,
        dryRun: true,
      }),
    });
    const json = await res.json();
    setImportMessage(
      res.ok
        ? `Preview OK: ${json.total} rows, ${json.invalid} invalid. First: ${json.preview?.[0]?.text ?? "—"}`
        : json.error,
    );
  }

  async function runImport(e: FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/workspaces/${workspaceId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityId,
        format: "csv",
        mapping: { text: "text", publishedAt: "date", rating: "rating" },
        content: csv,
        dryRun: false,
      }),
    });
    const json = await res.json();
    setImportMessage(
      res.ok
        ? `Imported ${json.inserted} rows (${json.duplicates} duplicates skipped, ${json.invalid} invalid).`
        : json.error,
    );
    router.refresh();
  }

  async function deleteWorkspace() {
    if (deleteConfirm !== workspace.name) return;
    const res = await fetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
    if (res.ok) router.push("/app");
  }

  return (
    <div className="mt-10 space-y-12">
      <section className="space-y-2 text-sm">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Providers</h2>
        <p>
          SerpApi live collection:{" "}
          <strong>{providerStatus.serpapi ? "configured" : "disabled"}</strong>
        </p>
        <p>
          TypeSafe/Jev classification:{" "}
          <strong>{providerStatus.jev ? "configured" : "paused"}</strong>
        </p>
        <p className="text-[var(--color-ink-muted)]">
          Usage {workspace.usage_consumed ?? 0}/{workspace.usage_limit ?? 0} (workspace budget,
          not a shared account balance).
        </p>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">Entities</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {entities.map((e) => (
            <li key={e.entity.id} className="border-b border-[var(--color-border)] py-2">
              <span className="font-medium">{e.entity.name}</span> · {e.role} · {e.entity.source}
              <div className="text-[var(--color-ink-muted)]">
                {e.entity.provider_id}
                {e.entity.url ? (
                  <>
                    {" "}
                    ·{" "}
                    <a href={e.entity.url} className="text-[var(--color-action)]">
                      link
                    </a>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <Link
          href={`/w/${workspaceId}/onboarding/entity`}
          className="mt-3 inline-block text-sm text-[var(--color-action)]"
        >
          Add or confirm entities
        </Link>
      </section>

      <section id="import">
        <h2 className="font-[family-name:var(--font-display)] text-xl">CSV import</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Mapping preview, validation, 2MB / 5000-row limits, provenance, duplicate handling by
          provider id / content hash.
        </p>
        <form onSubmit={runImport} className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="entity">Entity</Label>
            <select
              id="entity"
              className="h-10 w-full max-w-md rounded-md border border-[var(--color-border)] bg-white px-3 text-sm"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              required
            >
              {entities.map((e) => (
                <option key={e.entity.id} value={e.entity.id}>
                  {e.entity.name} ({e.role})
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="min-h-40 w-full rounded-md border border-[var(--color-border)] p-3 font-mono text-xs"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={dryRunImport}>
              Preview mapping
            </Button>
            <Button type="submit" disabled={role === "viewer" || !entityId}>
              Import
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={role === "viewer"}
              onClick={async () => {
                const res = await fetch(`/api/workspaces/${workspaceId}/process`, {
                  method: "POST",
                });
                const json = await res.json();
                setImportMessage(
                  res.ok
                    ? `Processed: classified ${json.classified ?? 0}. ${json.message ?? ""}`
                    : json.error,
                );
                router.refresh();
              }}
            >
              Classify & aggregate
            </Button>
          </div>
          {importMessage ? (
            <p className="text-sm text-[var(--color-ink-muted)]">{importMessage}</p>
          ) : null}
        </form>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">Members</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {members.map((m) => (
            <li key={m.id}>
              {m.user_id.slice(0, 8)}… · {m.role}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">Danger zone</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Workspace deletion removes associated storage pointers and cancels pending processing.
        </p>
        {role === "owner" ? (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="space-y-2">
              <Label htmlFor="confirm">Type workspace name to confirm</Label>
              <Input
                id="confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
              />
            </div>
            <Button
              variant="pain"
              type="button"
              disabled={deleteConfirm !== workspace.name}
              onClick={deleteWorkspace}
            >
              Delete workspace
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-sm">Only owners can delete the workspace.</p>
        )}
      </section>
    </div>
  );
}
