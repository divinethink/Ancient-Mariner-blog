import { describe, expect, it } from "vitest";
import { periodOf } from "./diaryPeriod";

const at = (iso: string) => new Date(iso);
describe("periodOf", () => {
  it("Asia/Dhaka (UTC+6): সীমানাগুলো", () => {
    expect(periodOf(at("2026-10-23T23:00:00Z"), "Asia/Dhaka")).toBe("morning"); // ০৫:০০
    expect(periodOf(at("2026-10-23T05:59:00Z"), "Asia/Dhaka")).toBe("morning"); // ১১:৫৯
    expect(periodOf(at("2026-10-23T06:00:00Z"), "Asia/Dhaka")).toBe("noon"); // ১২:০০
    expect(periodOf(at("2026-10-23T10:00:00Z"), "Asia/Dhaka")).toBe("afternoon"); // ১৬:০০
    expect(periodOf(at("2026-10-23T12:00:00Z"), "Asia/Dhaka")).toBe("evening"); // ১৮:০০
    expect(periodOf(at("2026-10-23T14:00:00Z"), "Asia/Dhaka")).toBe("night"); // ২০:০০
    expect(periodOf(at("2026-10-22T22:59:00Z"), "Asia/Dhaka")).toBe("night"); // ০৪:৫৯
  });
  it("timezone বদলালে ঘণ্টাও বদলায়; মধ্যরাত = রাত", () => {
    expect(periodOf(at("2026-10-23T12:00:00Z"), "UTC")).toBe("noon");
    expect(periodOf(at("2026-10-23T18:00:00Z"), "Asia/Dhaka")).toBe("night"); // ০০:০০
  });
  it("অবৈধ/অনুপস্থিত সময় বা timezone হলে null", () => {
    expect(periodOf(undefined, "UTC")).toBeNull();
    expect(periodOf(new Date("x"), "UTC")).toBeNull();
    expect(periodOf(at("2026-10-23T06:00:00Z"), "Not/AZone")).toBeNull();
  });
});
