"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Task = {
  id: string;
  title: string;
  status: string;
  priority: number | null;
  effort: number | null;
  due_date: string | null;
  recurring: boolean;
  task_evidence?: Array<{ feedback_id: string }>;
};

type Intervention = {
  id: string;
  description: string;
  outcome: string | null;
  implemented_at: string;
  result: { observedPercentagePointChange?: number | null; disclaimer?: string } | null;
};

const columns = [
  "needs_attention",
  "in_progress",
  "monitoring",
  "closed",
] as const;

const labels: Record<(typeof columns)[number], string> = {
  needs_attention: "Needs Attention",
  in_progress: "In Progress",
  monitoring: "Monitoring",
  closed: "Closed",
};

export function TaskBoard({
  workspaceId,
  tasks,
  interventions,
  canEdit,
}: {
  workspaceId: string;
  tasks: Task[];
  interventions: Intervention[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [effort, setEffort] = useState("0.5");
  const [message, setMessage] = useState<string | null>(null);

  async function createTask(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        title,
        effort: Number(effort),
        evidenceFeedbackIds: [],
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error ?? "Could not create task");
      return;
    }
    setTitle("");
    setMessage(json.attached ? json.message : "Task created");
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-12">
      {canEdit ? (
        <form onSubmit={createTask} className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="title">New task</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-72"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="effort">Effort (0–1)</Label>
            <Input
              id="effort"
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={effort}
              onChange={(e) => setEffort(e.target.value)}
              className="w-28"
            />
          </div>
          <Button type="submit">Add task</Button>
          {message ? <p className="text-sm text-[var(--color-ink-muted)]">{message}</p> : null}
        </form>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((status) => (
          <section key={status}>
            <h2 className="text-sm font-semibold tracking-wide text-[var(--color-ink-muted)] uppercase">
              {labels[status]}
            </h2>
            <ul className="mt-3 space-y-3">
              {tasks
                .filter((t) => t.status === status)
                .map((task) => (
                  <li key={task.id} className="border border-[var(--color-border)] p-3">
                    <div className="font-medium">{task.title}</div>
                    <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
                      Priority {task.priority ?? "—"} · Effort {task.effort ?? "—"} · Evidence{" "}
                      {task.task_evidence?.length ?? 0}
                      {task.recurring ? " · Recurring" : ""}
                    </div>
                  </li>
                ))}
              {tasks.filter((t) => t.status === status).length === 0 ? (
                <li className="text-sm text-[var(--color-ink-muted)]">None</li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          Priority vs effort
        </h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-ink-muted)]">
              <th className="py-2">Task</th>
              <th className="py-2">Priority</th>
              <th className="py-2">Effort</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-b border-[var(--color-border)]">
                <td className="py-2">{t.title}</td>
                <td className="py-2">{t.priority ?? "—"}</td>
                <td className="py-2">{t.effort ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-2xl">Interventions</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Before/after rate comparisons. Never reported as causation.
        </p>
        <ul className="mt-4 space-y-3">
          {interventions.length === 0 ? (
            <li className="text-sm text-[var(--color-ink-muted)]">No interventions recorded.</li>
          ) : (
            interventions.map((i) => (
              <li key={i.id} className="border-b border-[var(--color-border)] py-3 text-sm">
                <div className="font-medium">{i.description}</div>
                <div className="text-[var(--color-ink-muted)]">
                  {new Date(i.implemented_at).toLocaleDateString()} · {i.outcome ?? "pending"}
                  {i.result?.observedPercentagePointChange != null
                    ? ` · Δ ${(i.result.observedPercentagePointChange * 100).toFixed(1)} pp`
                    : ""}
                </div>
                <div className="text-xs text-[var(--color-ink-muted)]">
                  {i.result?.disclaimer}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
