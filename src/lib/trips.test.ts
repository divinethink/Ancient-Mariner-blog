import { describe, expect, it } from "vitest";
import { parseCost, sortBeen, totalCost } from "./trips";

describe("parseCost", () => {
  it("ইংরেজি/বাংলা অঙ্ক, কমা, ৳", () => {
    expect(parseCost("12000")).toEqual({ ok: true, value: 12000 });
    expect(parseCost(" ৳ ১২,০০০ ")).toEqual({ ok: true, value: 12000 });
    expect(parseCost("০")).toEqual({ ok: true, value: 0 });
  });
  it("ফাঁকা = খরচ নেই; দশমিক/অক্ষর/ঋণাত্মক/সীমা-ছাড়া ব্যর্থ", () => {
    expect(parseCost("   ")).toEqual({ ok: true });
    expect(parseCost("12.5")).toEqual({ ok: false });
    expect(parseCost("-5")).toEqual({ ok: false });
    expect(parseCost("১২ টাকা")).toEqual({ ok: false });
    expect(parseCost("999999999")).toEqual({ ok: false });
    expect(parseCost("1234567890")).toEqual({ ok: false });
  });
});

describe("totalCost / sortBeen", () => {
  it("শুধু গিয়েছি-ট্রিপের খরচ যোগ", () => {
    expect(totalCost([{ status: "been", costTaka: 1000 }, { status: "been" }, { status: "wish", costTaka: 500 }, { status: "been", costTaka: 250 }])).toBe(1250);
  });
  it("তারিখ নতুন আগে, তারিখহীন শেষে", () => {
    expect(sortBeen([{ day: "2025-01-01" }, {}, { day: "2026-03-02" }]).map((t) => t.day)).toEqual(["2026-03-02", "2025-01-01", undefined]);
  });
});
