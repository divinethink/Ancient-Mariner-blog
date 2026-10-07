import { describe, expect, it } from "vitest";
import { readingMinutes } from "./readingTime";

describe("readingMinutes", () => {
  it("ceil(শব্দ/২০০)", () => {
    expect(readingMinutes(1)).toBe(1);
    expect(readingMinutes(200)).toBe(1);
    expect(readingMinutes(201)).toBe(2);
    expect(readingMinutes(1000)).toBe(5);
  });
  it("শব্দ নেই/অবৈধ = ০", () => {
    expect(readingMinutes(0)).toBe(0);
    expect(readingMinutes(-5)).toBe(0);
    expect(readingMinutes(NaN)).toBe(0);
  });
});
