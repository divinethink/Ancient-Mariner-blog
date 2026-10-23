import { describe, expect, it } from "vitest";
import { countByStatus, finishedInYear, isDayKey, publicShelf, sortFinished } from "./books";

describe("books", () => {
  const b = [
    { status: "finished", endDay: "2026-03-01" },
    { status: "finished", endDay: "2025-12-31" },
    { status: "finished" },
    { status: "reading" },
    { status: "wishlist" },
    { status: "bogus" },
  ];
  it("বছরে শেষ-করা বই (endDay ছাড়া গোনা হয় না)", () => {
    expect(finishedInYear(b, 2026)).toBe(1);
    expect(finishedInYear(b, 2025)).toBe(1);
    expect(finishedInYear(b, 2024)).toBe(0);
  });
  it("অবস্থা-অনুযায়ী সংখ্যা; অজানা অবস্থা বাদ", () => {
    expect(countByStatus(b)).toEqual({ wishlist: 1, reading: 1, finished: 3 });
  });
  it("শেষ-করা নতুন আগে, endDay-ছাড়া শেষে", () => {
    expect(sortFinished(b.filter((x) => x.status === "finished")).map((x) => x.endDay)).toEqual(["2026-03-01", "2025-12-31", undefined]);
  });
  it("দিন-key", () => {
    expect(isDayKey("2026-10-22")).toBe(true);
    expect(isDayKey("22-10-2026")).toBe(false);
  });

  it("পাবলিক তাক: private বাদ; ক্রম ঠিক", () => {
    const d = (x: string) => new Date(x);
    const bk = (id: string, status: string, visibility: string, up: string, endDay?: string) => ({ id, status, visibility, updatedAt: d(up), ...(endDay && { endDay }) });
    const g = publicShelf([
      bk("r1", "reading", "public", "2026-10-01"),
      bk("r2", "reading", "public", "2026-10-05"),
      bk("rp", "reading", "private", "2026-10-09"),
      bk("f1", "finished", "public", "2026-10-02", "2026-09-01"),
      bk("f2", "finished", "public", "2026-10-03", "2026-10-01"),
      bk("fx", "finished", "bogus", "2026-10-03", "2026-10-02"),
      bk("w1", "wishlist", "public", "2026-10-04"),
    ]);
    expect(g.reading.map((x) => x.id)).toEqual(["r2", "r1"]);
    expect(g.finished.map((x) => x.id)).toEqual(["f2", "f1"]);
    expect(g.wishlist.map((x) => x.id)).toEqual(["w1"]);
  });
});
