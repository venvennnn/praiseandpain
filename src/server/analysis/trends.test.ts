import { describe, expect, it } from "vitest";
import { buildTrends, chooseGrain, type TrendReview } from "./trends";

function review(partial: Partial<TrendReview> & { publishedAt: string }): TrendReview {
  return {
    rating: null,
    status: "ok",
    isPraise: false,
    isComplaint: false,
    irrelevant: false,
    aspects: [],
    ...partial,
  };
}

describe("trend grain", () => {
  it("uses weeks inside a short window and months across a long one", () => {
    expect(chooseGrain(["2024-01-01", "2024-03-01"])).toBe("week");
    expect(chooseGrain(["2023-01-01", "2024-06-01"])).toBe("month");
  });
});

describe("buildTrends", () => {
  it("tracks positive and negative shares without putting mixed reviews in either", () => {
    const series = buildTrends(
      [
        review({ publishedAt: "2024-01-05T00:00:00.000Z", isPraise: true }),
        review({ publishedAt: "2024-01-06T00:00:00.000Z", isPraise: true }),
        review({ publishedAt: "2024-01-07T00:00:00.000Z", isComplaint: true }),
        review({ publishedAt: "2024-01-08T00:00:00.000Z", isPraise: true, isComplaint: true }),
        review({ publishedAt: "2024-02-02T00:00:00.000Z", isComplaint: true }),
        review({ publishedAt: "2024-02-03T00:00:00.000Z", isPraise: true }),
      ],
      { timeZone: "UTC", grain: "month" },
    );

    const january = series.points.find((point) => point.period === "2024-01");
    expect(january?.n).toBe(4);
    expect(january?.praise).toBe(2);
    expect(january?.pain).toBe(1);
    expect(january?.mixed).toBe(1);
    expect(january?.praiseRate).toBeCloseTo(0.5);
    expect(january?.painRate).toBeCloseTo(0.25);
    expect(january?.praiseLower).not.toBeNull();
    expect(january?.praiseUpper).toBeGreaterThan(january?.praiseRate ?? 0);
    expect(series.grain).toBe("month");
  });

  it("leaves a gap month empty instead of inventing a zero rate", () => {
    const series = buildTrends(
      [
        review({ publishedAt: "2024-01-05T00:00:00.000Z", isPraise: true }),
        review({ publishedAt: "2024-03-05T00:00:00.000Z", isComplaint: true }),
      ],
      { timeZone: "UTC", grain: "month" },
    );
    const february = series.points.find((point) => point.period === "2024-02");
    expect(february?.collected).toBe(0);
    expect(february?.praiseRate).toBeNull();
    expect(february?.painRate).toBeNull();
  });

  it("drops failed, irrelevant, and undated reviews from the rate denominator", () => {
    const series = buildTrends(
      [
        review({ publishedAt: "2024-06-01T00:00:00.000Z", isPraise: true }),
        review({ publishedAt: "2024-06-02T00:00:00.000Z", status: "failed", isComplaint: true }),
        review({ publishedAt: "2024-06-03T00:00:00.000Z", irrelevant: true, isComplaint: true }),
        review({ publishedAt: null as unknown as string }),
      ],
      { timeZone: "UTC", grain: "month" },
    );
    expect(series.undated).toBe(1);
    expect(series.points[0]?.collected).toBe(3);
    expect(series.points[0]?.n).toBe(1);
    expect(series.points[0]?.praiseRate).toBe(1);
  });

  it("trends theme prevalence and negative share", () => {
    const staff = (sentiment: string) => [{ key: "staff", sentiment }];
    const rows: TrendReview[] = [];
    for (let i = 0; i < 8; i++) {
      rows.push(
        review({
          publishedAt: "2024-01-10T00:00:00.000Z",
          isPraise: true,
          aspects: staff("positive"),
        }),
      );
    }
    for (let i = 0; i < 8; i++) {
      rows.push(
        review({
          publishedAt: "2024-08-10T00:00:00.000Z",
          isComplaint: true,
          aspects: staff(i < 6 ? "negative" : "positive"),
        }),
      );
    }
    const series = buildTrends(rows, { timeZone: "UTC" });
    const staffTrend = series.categories.find((category) => category.key === "staff");
    const january = staffTrend?.points.find((point) => point.period === "2024-01");
    const august = staffTrend?.points.find((point) => point.period === "2024-08");
    expect(january?.prevalence).toBe(1);
    expect(january?.negativeShare).toBe(0);
    expect(august?.negativeShare).toBeCloseTo(0.75);
    expect(series.praiseShift?.percentagePoints).toBeCloseTo(-100);
    expect(series.categoryMovers[0]?.key).toBe("staff");
    expect(series.categoryMovers[0]?.percentagePoints).toBeCloseTo(75);
  });
});
