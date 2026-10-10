"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Idea = {
  id: string;
  title: string;
  status: string;
  notes: string | null;
  analysis: Record<string, unknown> | null;
};

export function IdeasBoard({
  workspaceId,
  ideas,
  canEdit,
  isCreator,
}: {
  workspaceId: string;
  ideas: Idea[];
  canEdit: boolean;
  isCreator: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");

  if (!isCreator) {
    return (
      <p className="mt-8 text-sm text-[var(--color-ink-muted)]">
        Creator backlog is available for Creator workspaces. Your workspace kind does not use
        this board.
      </p>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/workspaces/${workspaceId}/ideas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      setTitle("");
      router.refresh();
    }
  }

  return (
    <div className="mt-8 space-y-8">
      {canEdit ? (
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Idea title"
            required
            className="max-w-md"
          />
          <Button type="submit">Add idea</Button>
        </form>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        {(["considering", "planned", "published"] as const).map((status) => (
          <section key={status}>
            <h2 className="text-sm font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">
              {status}
            </h2>
            <ul className="mt-3 space-y-3">
              {ideas
                .filter((i) => i.status === status)
                .map((idea) => (
                  <li key={idea.id} className="border border-[var(--color-border)] p-3 text-sm">
                    <div className="font-medium">{idea.title}</div>
                    {idea.notes ? (
                      <p className="mt-1 text-[var(--color-ink-muted)]">{idea.notes}</p>
                    ) : null}
                    {idea.analysis ? (
                      <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
                        Transcript analysis attached (topic/hook/format/CTA from available text
                        only).
                      </p>
                    ) : null}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
