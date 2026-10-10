import Link from "next/link";
import {
  FileText,
  LayoutDashboard,
  Lightbulb,
  ListTodo,
  MessageSquareText,
  Scale,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "overview", label: "Overview", icon: LayoutDashboard },
  { href: "feedback", label: "Praise & Pain", icon: Sparkles },
  { href: "feedback", label: "Evidence", icon: MessageSquareText },
  { href: "competitors", label: "Competitors", icon: Scale },
  { href: "tasks", label: "Actions", icon: ListTodo },
  { href: "ideas", label: "Ideas", icon: Lightbulb },
  { href: "reports", label: "Reports", icon: FileText },
  { href: "settings", label: "Settings", icon: Settings },
];

export function WorkspaceShell({
  workspaceId,
  workspaceName,
  providerStatus,
  children,
  active,
}: {
  workspaceId: string;
  workspaceName: string;
  providerStatus: { serpapi: boolean; jev: boolean };
  children: React.ReactNode;
  active: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-app)] md:grid md:grid-cols-[232px_1fr]">
      <aside className="border-b border-[var(--color-border)] bg-white md:sticky md:top-0 md:h-screen md:border-r md:border-b-0">
        <Link href="/app" className="flex items-center gap-2 px-5 py-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-ink)] text-xs font-semibold text-white">
            P&P
          </span>
          <span className="truncate text-sm font-semibold">{workspaceName}</span>
        </Link>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:px-3">
          {links.map((link) => {
            const Icon = link.icon;
            const on = active === link.href && link.label !== "Evidence";
            return (
              <Link
                key={link.label}
                href={`/w/${workspaceId}/${link.href}`}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm whitespace-nowrap",
                  on
                    ? "bg-[var(--color-highlight)] font-semibold text-[var(--color-action)]"
                    : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-5 py-4 text-xs md:block">
          <p className={providerStatus.serpapi ? "text-[var(--color-praise)]" : "text-[var(--color-pain)]"}>
            {providerStatus.serpapi ? "SerpApi live" : "SerpApi required"}
          </p>
          <p className={providerStatus.jev ? "text-[var(--color-praise)]" : "text-[var(--color-pain)]"}>
            {providerStatus.jev ? "Jev live" : "Jev required"}
          </p>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
