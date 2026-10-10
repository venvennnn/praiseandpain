import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const links = [
  { href: "overview", label: "Overview" },
  { href: "feedback", label: "Feedback" },
  { href: "competitors", label: "Competitors" },
  { href: "tasks", label: "Tasks" },
  { href: "ideas", label: "Creator backlog" },
  { href: "reports", label: "Reports" },
  { href: "settings", label: "Settings" },
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
    <div className="min-h-screen bg-white">
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/app">
              <BrandMark className="text-xl font-semibold" />
            </Link>
            <div className="hidden text-sm text-[var(--color-ink-muted)] md:block">
              {workspaceName}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {!providerStatus.serpapi ? (
              <span className="font-medium text-[var(--color-pain)]">SerpApi required</span>
            ) : (
              <span className="text-[var(--color-praise)]">SerpApi live</span>
            )}
            {!providerStatus.jev ? (
              <span className="font-medium text-[var(--color-pain)]">Jev required</span>
            ) : (
              <span className="text-[var(--color-praise)]">Jev live</span>
            )}
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={`/w/${workspaceId}/${link.href}`}
              className={cn(
                "whitespace-nowrap px-3 py-2 text-sm transition",
                active === link.href
                  ? "border-b-2 border-[var(--color-action)] font-semibold text-[var(--color-ink)]"
                  : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
