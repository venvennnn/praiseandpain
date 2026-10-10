export type ReviewTone = "praise" | "pain" | "plain";

export function reviewTone(input: {
  is_praise?: boolean | null;
  is_complaint?: boolean | null;
  status?: string | null;
} | null | undefined): ReviewTone {
  if (!input || input.status === "failed" || input.status === "skipped") return "plain";
  if (input.is_praise && !input.is_complaint) return "praise";
  if (input.is_complaint && !input.is_praise) return "pain";
  return "plain";
}

export function toneClass(tone: ReviewTone): string {
  if (tone === "praise") return "tone-praise";
  if (tone === "pain") return "tone-pain";
  return "tone-neutral";
}
