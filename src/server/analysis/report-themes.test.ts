import { describe, expect, it } from "vitest";
import { rankThemes } from "./report-themes";

function metric(share: number, mentions: number) {
  return {
    praise_share: { value: share, denominator: mentions, numerator: Math.round(share * mentions), status: "ok" },
    complaint_share: { value: 1 - share, denominator: mentions, numerator: mentions - Math.round(share * mentions), status: "ok" },
  };
}

describe("rankThemes", () => {
  it("prefers specific issues once three of them have mentions", () => {
    const ranked = rankThemes(
      {
        staff: metric(0.2, 40),
        staff_rude: metric(0.1, 8),
        long_wait: metric(0.4, 6),
        food_cold: metric(0.3, 5),
      },
      "pain",
      5,
    );
    expect(ranked.map((row) => row.key)).toEqual(["staff_rude", "food_cold", "long_wait"]);
  });

  it("keeps broad themes when specific issues are still sparse", () => {
    const ranked = rankThemes(
      {
        staff: metric(0.7, 12),
        food: metric(0.4, 9),
        staff_rude: metric(0.9, 2),
      },
      "praise",
      5,
    );
    expect(ranked.map((row) => row.key)).toEqual(["staff", "food"]);
  });
});
