import { describe, expect, it } from "vitest";
import { bookToc } from "./diaryBook";
import type { DownloadEntry } from "./diaryExport";

const e = (day: string, extra: Partial<DownloadEntry> = {}): DownloadEntry => ({ id: day + (extra.title ?? ""), day, title: "", lines: ["এক দুই তিন"], ...extra });

describe("diaryBook", () => {
  it("সূচি: মাসভিত্তিক গণনা, একাধিক বছরে বছরসহ লেবেল", () => {
    expect(bookToc([e("2026-01-02"), e("2026-01-09", { title: "x" }), e("2026-03-01")]).map((r) => r.count)).toEqual([2, 1]);
    expect(bookToc([e("2025-12-01"), e("2026-01-01")]).map((r) => r.label)).toEqual(["ডিসেম্বর ২০২৫", "জানুয়ারি ২০২৬"]);
    expect(bookToc([e("")])).toEqual([]);
  });
});
