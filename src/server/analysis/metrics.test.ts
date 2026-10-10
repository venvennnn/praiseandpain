import { describe, expect, it } from "vitest";
import {
  complaintShare,
  praiseShare,
  prevalence,
  compareComplaintShares,
  priorityScore,
  type AspectCounts,
} from "./metrics";
import { betaComplaintShare, posteriorDifferenceProbability } from "./beta";
import { CALCULATION_VERSION } from "@/shared/schemas/metrics";

const period = {
  start: "2024-01-01T00:00:00.000Z",
  end: "2024-01-31T23:59:59.000Z",
  timezone: "UTC",
};

function counts(partial: Partial<AspectCounts>): AspectCounts {
  return {
    n: 0,
    m: 0,
    c: 0,
    p: 0,
    evidenceIds: [],
    exclusions: { excluded: 0, uncertain: 0, duplicate: 0, undated: 0 },
    ...partial,
  };
}

describe("metrics", () => {
  it("returns unavailable (not zero) for null denominators", () => {
    const m = complaintShare(counts({ n: 10, m: 0, c: 0 }), period);
    expect(m.status).toBe("unavailable");
    expect(m.value).toBeNull();
    expect(m.denominator).toBeNull();
    expect(m.calculationVersion).toBe(CALCULATION_VERSION);
  });

  it("computes prevalence complaint share and praise share with fixture", () => {
    // Fixture walkthrough:
    // N=100 classified eligible, M=40 mention wait_time, C=10 negative, P=25 positive
    // (5 mixed counted in both C and P)
    const c = counts({
      n: 100,
      m: 40,
      c: 10,
      p: 25,
      evidenceIds: ["11111111-1111-1111-1111-111111111111"],
    });
    expect(prevalence(c, period).value).toBeCloseTo(0.4);
    expect(complaintShare(c, period).value).toBeCloseTo(0.25);
    expect(praiseShare(c, period).value).toBeCloseTo(0.625);
    expect(complaintShare(c, period).numerator).toBe(10);
    expect(complaintShare(c, period).denominator).toBe(40);
  });

  it("beta interval is within [0,1] and contains the mean", () => {
    const beta = betaComplaintShare(10, 40);
    expect(beta).not.toBeNull();
    expect(beta!.lower).toBeGreaterThanOrEqual(0);
    expect(beta!.upper).toBeLessThanOrEqual(1);
    expect(beta!.lower).toBeLessThan(beta!.mean);
    expect(beta!.upper).toBeGreaterThan(beta!.mean);
  });

  it("marks insufficient data below mention threshold", () => {
    const result = compareComplaintShares({
      entityAId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      entityBId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      countsA: counts({ n: 50, m: 10, c: 2, p: 5 }),
      countsB: counts({ n: 50, m: 10, c: 5, p: 3 }),
      period,
      source: "google_maps",
      language: "en",
      aspectId: null,
    });
    expect(result.interpretation).toBe("insufficient_data");
    expect(result.thresholdsAreHeuristics).toBe(true);
  });

  it("posterior draws are seeded and reproducible", () => {
    const a = posteriorDifferenceProbability({
      complaintsA: 10,
      mentionsA: 40,
      complaintsB: 20,
      mentionsB: 40,
      practicalThreshold: 0.05,
      seed: 7,
    });
    const b = posteriorDifferenceProbability({
      complaintsA: 10,
      mentionsA: 40,
      complaintsB: 20,
      mentionsB: 40,
      practicalThreshold: 0.05,
      seed: 7,
    });
    expect(a?.probabilityABetter).toBe(b?.probabilityABetter);
    expect(a!.probabilityABetter).toBeGreaterThan(0.5);
  });

  it("renormalises priority components and lists missing inputs", () => {
    const result = priorityScore({
      severity: 0.8,
      prevalence: 0.4,
      momentum: null,
      breadth: 0.2,
      competitiveGap: undefined,
    });
    expect(result.score).not.toBeNull();
    expect(result.missing).toEqual(expect.arrayContaining(["momentum", "competitiveGap"]));
    const weightSum = Object.values(result.weightsUsed).reduce((a, b) => a + b, 0);
    expect(weightSum).toBeCloseTo(1);
  });
});
