import { describe, expect, it } from "vitest";
import { inRange, weekRange, weekdayOf } from "./week";

describe("week", () => {
  it("বার (২০২৬-১০-২২ = বৃহস্পতিবার)", () => {
    expect(weekdayOf("2026-10-22")).toBe(4);
    expect(weekdayOf("2026-10-18")).toBe(0);
    expect(weekdayOf("bad")).toBe(0);
  });
  it("সপ্তাহ রবি–শনি; আগের/পরের সপ্তাহ; বছর পেরোয়", () => {
    expect(weekRange("2026-10-23")).toEqual({ from: "2026-10-18", to: "2026-10-24" });
    expect(weekRange("2026-10-18")).toEqual({ from: "2026-10-18", to: "2026-10-24" });
    expect(weekRange("2026-10-24")).toEqual({ from: "2026-10-18", to: "2026-10-24" });
    expect(weekRange("2026-10-23", -1)).toEqual({ from: "2026-10-11", to: "2026-10-17" });
    expect(weekRange("2027-01-01")).toEqual({ from: "2026-12-27", to: "2027-01-02" });
  });
  it("inRange সীমা-সহ", () => {
    expect(inRange("2026-10-18", "2026-10-18", "2026-10-24")).toBe(true);
    expect(inRange("2026-10-24", "2026-10-18", "2026-10-24")).toBe(true);
    expect(inRange("2026-10-25", "2026-10-18", "2026-10-24")).toBe(false);
    expect(inRange(undefined, "2026-10-18", "2026-10-24")).toBe(false);
  });
});
