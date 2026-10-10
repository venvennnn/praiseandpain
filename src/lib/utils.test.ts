import { describe, expect, it } from "vitest";
import { formulaSafeCsvCell } from "./utils";

describe("formulaSafeCsvCell", () => {
  it("neutralises formula injection", () => {
    expect(formulaSafeCsvCell("=1+2")).toBe(`"'=1+2"`);
    expect(formulaSafeCsvCell("+cmd")).toBe(`"'+cmd"`);
    expect(formulaSafeCsvCell("safe")).toBe("safe");
  });
});
