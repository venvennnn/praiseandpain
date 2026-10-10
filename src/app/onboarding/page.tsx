"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const kinds = [
  { id: "business", label: "Business", blurb: "Locations and Google Maps reviews" },
  { id: "app", label: "App", blurb: "App Store and Google Play reviews" },
  { id: "creator", label: "Creator", blurb: "YouTube comments and available transcripts" },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [kind, setKind] = useState<(typeof kinds)[number]["id"]>("business");
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        kind,
        timezone,
        language: "en",
        analysisWindowDays: 90,
        refreshCadenceHours: 24,
        retrievalBudget: 200,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Could not create workspace");
      return;
    }
    router.push(`/w/${json.workspace.id}/onboarding/entity`);
  }

  return (
    <div className="hero-atmosphere min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <BrandMark className="text-3xl font-semibold" />
        <h1 className="mt-10 font-[family-name:var(--font-display)] text-4xl">
          Set up your workspace
        </h1>
        <p className="mt-3 text-[var(--color-ink-muted)]">
          Choose how you collect feedback. You will confirm your entity and up to three
          competitors next.
        </p>
        <form onSubmit={onSubmit} className="mt-10 space-y-8">
          <div className="grid gap-3 md:grid-cols-3">
            {kinds.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`border px-4 py-5 text-left transition ${
                  kind === k.id
                    ? "border-[var(--color-action)] bg-[var(--color-highlight)]"
                    : "border-[var(--color-border)] bg-white"
                }`}
              >
                <div className="font-semibold">{k.label}</div>
                <div className="mt-1 text-sm text-[var(--color-ink-muted)]">{k.blurb}</div>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Workspace name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Coffee"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              required
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-[var(--color-pain)]">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
