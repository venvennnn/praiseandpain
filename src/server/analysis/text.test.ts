import { describe, expect, it } from "vitest";
import {
  contentHash,
  findEvidenceOffsets,
  splitSentences,
  validateEvidenceSpan,
} from "./text";
import { parseFeedbackDate, isEligibleForPeriodComparison } from "./dates";

describe("text + dates", () => {
  it("hashes stably", () => {
    expect(contentHash("hello")).toBe(contentHash("hello"));
    expect(contentHash("hello")).not.toBe(contentHash("hello!"));
  });

  it("splits sentences with exact offsets", () => {
    const text = "Cold beer was fine. The food arrived cold.";
    const spans = splitSentences(text);
    expect(spans.length).toBe(2);
    for (const span of spans) {
      expect(validateEvidenceSpan(text, span.start, span.end, span.text)).toBe(true);
    }
    const food = findEvidenceOffsets(text, "The food arrived cold.");
    expect(food?.start).toBe(text.indexOf("The food arrived cold."));
    expect(food?.end).toBe(text.length);
  });

  it("excludes undated feedback from period comparisons", () => {
    const undated = parseFeedbackDate(null);
    expect(isEligibleForPeriodComparison(undated)).toBe(false);
    const dated = parseFeedbackDate("2024-05-01");
    expect(isEligibleForPeriodComparison(dated)).toBe(true);
  });
});
