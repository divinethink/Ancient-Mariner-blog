import { describe, expect, it } from "vitest";
import { bookCoverLines, bookStats, bookToc, bookYears } from "./diaryBook";
import type { DownloadEntry } from "./diaryExport";

const e = (day: string, extra: Partial<DownloadEntry> = {}): DownloadEntry => ({ id: day + (extra.title ?? ""), day, title: "", lines: ["এক দুই তিন"], ...extra });

describe("diaryBook", () => {
  it("পরিসংখ্যান: দিন/জায়গা/শব্দ/সবচেয়ে বেশি স্থান ও বেলা", () => {
    const s = bookStats([e("2026-01-02", { location: "ঢাকা", period: "রাত" }), e("2026-01-02", { title: "b", location: "ঢাকা", period: "রাত" }), e("2026-02-03", { location: "নরসিংদী", period: "সকাল" })]);
    expect(s).toEqual({ days: 2, places: 2, words: 9, topPlace: "ঢাকা", favPeriod: "রাত" });
  });
  it("খালি তালিকায় শূন্য, ঐচ্ছিক ফিল্ড নেই", () => {
    expect(bookStats([])).toEqual({ days: 0, places: 0, words: 0 });
    expect(bookCoverLines(bookStats([]))).toEqual([]);
  });
  it("মলাট-লাইন: খালি অংশ বাদ", () => {
    expect(bookCoverLines({ days: 3, places: 0, words: 10 }).length).toBe(2);
    expect(bookCoverLines({ days: 3, places: 2, words: 10, topPlace: "ঢাকা", favPeriod: "রাত" }).length).toBe(4);
  });
  it("সূচি: মাসভিত্তিক গণনা, একাধিক বছরে বছরসহ লেবেল", () => {
    expect(bookToc([e("2026-01-02"), e("2026-01-09", { title: "x" }), e("2026-03-01")]).map((r) => r.count)).toEqual([2, 1]);
    expect(bookToc([e("2025-12-01"), e("2026-01-01")]).map((r) => r.label)).toEqual(["ডিসেম্বর ২০২৫", "জানুয়ারি ২০২৬"]);
    expect(bookToc([e("")])).toEqual([]);
  });
  it("বছর-লাইন", () => {
    expect(bookYears([e("2026-01-01")])).toBe("২০২৬");
    expect(bookYears([e("2024-01-01"), e("2026-05-01")])).toBe("২০২৪–২০২৬");
    expect(bookYears([])).toBe("");
  });
});
