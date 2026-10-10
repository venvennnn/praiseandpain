import { describe, expect, it } from "vitest";
import { buildHeadToHead, type PlaceProfile, type ThemeMetric } from "./head-to-head";

function theme(key: string, mentions: number, praise: number, pain: number): ThemeMetric {
  return { key, mentions, praiseShare: praise, painShare: pain };
}

function place(partial: Partial<PlaceProfile> & Pick<PlaceProfile, "id" | "name">): PlaceProfile {
  return {
    praiseRate: null,
    painRate: null,
    sampled: 0,
    themes: [],
    ...partial,
  };
}

describe("buildHeadToHead", () => {
  it("calls a lower pain share an advantage and keeps thin themes out", () => {
    const head = buildHeadToHead(
      place({
        id: "us",
        name: "Centrestage",
        praiseRate: 0.62,
        painRate: 0.2,
        sampled: 160,
        themes: [theme("staff", 40, 0.7, 0.12), theme("price", 4, 0.5, 0.1)],
      }),
      place({
        id: "them",
        name: "SCC Hotel",
        praiseRate: 0.41,
        painRate: 0.38,
        sampled: 150,
        themes: [theme("staff", 28, 0.4, 0.45), theme("price", 30, 0.2, 0.6)],
      }),
    );

    const staff = head.themes.find((theme) => theme.key === "staff");
    const price = head.themes.find((theme) => theme.key === "price");
    expect(staff?.stance).toBe("ahead");
    expect(staff?.painAdvantagePp).toBeCloseTo(33);
    expect(price?.stance).toBe("thin");
    expect(head.praiseAdvantagePp).toBeCloseTo(21);
    expect(head.painAdvantagePp).toBeCloseTo(18);
    expect(head.lines[0]).toContain("62% praise");
    expect(head.lines.some((line) => line.includes("stronger on staff"))).toBe(true);
  });

  it("marks a theme behind when the competitor has clearly less pain", () => {
    const head = buildHeadToHead(
      place({
        id: "us",
        name: "Us",
        themes: [theme("value", 20, 0.2, 0.55)],
      }),
      place({
        id: "them",
        name: "Them",
        themes: [theme("value", 22, 0.6, 0.2)],
      }),
    );
    expect(head.themes[0]?.stance).toBe("behind");
    expect(head.themes[0]?.painAdvantagePp).toBeCloseTo(-35);
  });

  it("flags shared pain when both sides are loud about the same theme", () => {
    const head = buildHeadToHead(
      place({
        id: "us",
        name: "Us",
        themes: [theme("speed", 18, 0.1, 0.5)],
      }),
      place({
        id: "them",
        name: "Them",
        themes: [theme("speed", 16, 0.15, 0.48)],
      }),
    );
    expect(head.themes[0]?.stance).toBe("close");
    expect(head.themes[0]?.sharedPain).toBe(true);
    expect(head.lines.some((line) => line.includes("Both places hear pain"))).toBe(true);
  });
});
