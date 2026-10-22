import { describe, expect, it } from "vitest";
import type { DiaryEntry } from "./diaryCalendar";
import { normPlace, placeStats, summarizeYear } from "./diarySummary";

const e = (day: string, words: number, location?: string): DiaryEntry => ({ id: `${day}-${words}`, day, title: "", body: "", words, at: 0, ...(location && { location }) });
const data = new Map<string, DiaryEntry[]>([
  ["2026-10-06", [e("2026-10-06", 100, "ঢাকা")]],
  ["2026-10-13", [e("2026-10-13", 400, " ঢাকা "), e("2026-10-13", 50, "ঢাকা")]],
  ["2026-11-02", [e("2026-11-02", 80, "খুলনা")]],
  ["2025-01-05", [e("2025-01-05", 900, "ঢাকা")]],
]);

describe("normPlace", () => {
  it("ছাঁটে, খালি হলে null", () => {
    expect(normPlace("  ঢাকা   শহর ")).toBe("ঢাকা শহর");
    expect(normPlace("   ")).toBeNull();
    expect(normPlace(undefined)).toBeNull();
  });
});

describe("placeStats", () => {
  it("একই দিনে একই জায়গা একবার; বেশি আগে", () => {
    const p = placeStats(data);
    expect(p[0]).toEqual({ name: "ঢাকা", count: 3, days: ["2025-01-05", "2026-10-06", "2026-10-13"] });
    expect(p[1]!.name).toBe("খুলনা");
  });
  it("বছর-ফিল্টার", () => {
    expect(placeStats(data, 2025).map((x) => x.name)).toEqual(["ঢাকা"]);
    expect(placeStats(data, 2024)).toEqual([]);
  });
});

describe("summarizeYear", () => {
  it("২০২৬: দিন, লেখা, শব্দ, সবচেয়ে লম্বা, ব্যস্ত মাস", () => {
    const s = summarizeYear(data, 2026);
    expect(s).toMatchObject({ days: 3, entries: 4, words: 630, longest: { day: "2026-10-13", words: 400 }, busiestMonth: { month: 10, days: 2 } });
    expect(s.places.map((p) => p.count)).toEqual([2, 1]);
  });
  it("লেখাহীন বছরে শূন্য, longest/busiestMonth নেই", () => {
    const s = summarizeYear(data, 2030);
    expect(s).toEqual({ year: 2030, days: 0, entries: 0, words: 0, places: [] });
  });
});
