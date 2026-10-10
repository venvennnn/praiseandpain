import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-baseline gap-1.5 font-[family-name:var(--font-display)]", className)}>
      <span className="text-[var(--color-praise)]">Praise</span>
      <span className="text-[var(--color-ink-muted)]">&</span>
      <span className="text-[var(--color-pain)]">Pain</span>
    </div>
  );
}
