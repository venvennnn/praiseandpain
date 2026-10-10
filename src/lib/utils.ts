import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercent(
  value: number | null | undefined,
  digits = 0,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(digits)}%`;
}

export function formulaSafeCsvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const needsEscape = /^[=+\-@]/.test(raw) || /[",\n\r]/.test(raw);
  const escaped = raw.replace(/"/g, '""');
  if (needsEscape || raw.includes(",")) {
    const safe = /^[=+\-@]/.test(escaped) ? `'${escaped}` : escaped;
    return `"${safe}"`;
  }
  return escaped;
}
