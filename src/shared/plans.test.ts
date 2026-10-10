import { describe, expect, it } from "vitest";
import { feedbackLimitForPlan, pagesToCoverNewest } from "./plans";
import { reviewTone } from "./tone";

describe("plan windows", () => {
  it("caps base at 200 and pro at 2000 per place", () => {
    expect(feedbackLimitForPlan("base")).toBe(200);
    expect(feedbackLimitForPlan(undefined)).toBe(200);
    expect(feedbackLimitForPlan("pro")).toBe(2000);
  });

  it("budgets enough pages to walk the newest window", () => {
    expect(pagesToCoverNewest(8)).toBe(1);
    expect(pagesToCoverNewest(200)).toBeGreaterThanOrEqual(20);
    expect(pagesToCoverNewest(2000)).toBeGreaterThan(pagesToCoverNewest(200));
  });
});

describe("review tone", () => {
  it("uses green only for praise, red only for pain, and white otherwise", () => {
    expect(reviewTone({ is_praise: true, is_complaint: false })).toBe("praise");
    expect(reviewTone({ is_praise: false, is_complaint: true })).toBe("pain");
    expect(reviewTone({ is_praise: true, is_complaint: true })).toBe("plain");
    expect(reviewTone({ is_praise: false, is_complaint: false })).toBe("plain");
    expect(reviewTone(null)).toBe("plain");
  });
});
