import { createHash } from "crypto";

export function contentHash(text: string): string {
  return createHash("sha256").update(text.normalize("NFC")).digest("hex");
}

export type SentenceSpan = {
  id: string;
  text: string;
  start: number;
  end: number;
};

/** Split into sentence spans with exact offsets into the original text. */
export function splitSentences(text: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  const re = /[^.!?]+[.!?]+|[^.!?]+$/g;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(text)) !== null) {
    const raw = match[0];
    const leading = raw.match(/^\s*/)?.[0].length ?? 0;
    const trailing = raw.match(/\s*$/)?.[0].length ?? 0;
    const start = match.index + leading;
    const end = match.index + raw.length - trailing;
    if (end <= start) continue;
    spans.push({
      id: `s${index}`,
      text: text.slice(start, end),
      start,
      end,
    });
    index += 1;
  }
  return spans;
}

export function validateEvidenceSpan(
  text: string,
  start: number,
  end: number,
  expectedExcerpt?: string,
): boolean {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end > text.length ||
    start >= end
  ) {
    return false;
  }
  if (expectedExcerpt !== undefined && text.slice(start, end) !== expectedExcerpt) {
    return false;
  }
  return true;
}

export function findEvidenceOffsets(
  text: string,
  excerpt: string,
): { start: number; end: number } | null {
  if (!excerpt) return null;
  const start = text.indexOf(excerpt);
  if (start < 0) return null;
  return { start, end: start + excerpt.length };
}
