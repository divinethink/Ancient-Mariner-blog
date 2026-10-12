import { describe, expect, it } from "vitest";
import { dayKey, formatDate, formatShortDateTime, fromZonedInput, toZonedInput, tzLabel } from "./datetime";

describe("dayKey (Asia/Dhaka = UTC+6)", () => {
  it("UTC 17:59 একই দিন, 18:00 পরের দিন", () => {
    expect(dayKey("2026-10-04T17:59:59Z")).toBe("2026-10-04");
    expect(dayKey("2026-10-04T18:00:00Z")).toBe("2026-10-05");
  });
  it("অন্য timezone মানে", () => {
    expect(dayKey("2026-10-04T18:00:00Z", "UTC")).toBe("2026-10-04");
  });
  it("বছরের সীমা", () => {
    expect(dayKey("2026-12-31T18:00:00Z")).toBe("2027-01-01");
  });
});

describe("formatDate", () => {
  it("বাংলা অঙ্ক ও মাস, সাইট-timezone-এ", () => {
    const s = formatDate("2026-10-04T18:00:00Z"); // ঢাকায় ৫ অক্টোবর
    expect(s).toContain("অক্টোবর");
    expect(s).toContain("৫");
    expect(s).toContain("২০২৬");
  });
});

describe("zoned input (প্রকাশের তারিখ)", () => {
  it("Asia/Dhaka (UTC+6) round-trip", () => {
    const utc = new Date("2026-10-05T18:30:00Z"); // ঢাকায় ০৬ অক্টোবর ০০:৩০
    expect(toZonedInput(utc)).toBe("2026-10-06T00:30");
    expect(fromZonedInput("2026-10-06T00:30")?.toISOString()).toBe("2026-10-05T18:30:00.000Z");
  });
  it("অন্য timezone (DST-সহ) ও অবৈধ ইনপুট", () => {
    expect(fromZonedInput("2026-07-01T12:00", "America/New_York")?.toISOString()).toBe("2026-07-01T16:00:00.000Z");
    expect(fromZonedInput("abc")).toBeNull();
    expect(fromZonedInput("2026-02-31T10:00")).toBeNull();
  });
});

describe("tzLabel", () => {
  it("id + offset", () => {
    expect(tzLabel("Asia/Dhaka", "2026-10-05T00:00:00Z")).toBe("Asia/Dhaka (GMT+6)");
    expect(tzLabel("UTC", "2026-10-05T00:00:00Z")).toMatch(/^UTC/);
  });
  it("অবৈধ id-তে শুধু id (throw নয়)", () => {
    expect(tzLabel("Mars/Base")).toBe("Mars/Base");
  });
});

describe("formatShortDateTime", () => {
  it("বছর ছাড়া, সাইট-timezone-এ দিন-মাস ও সময়", () => {
    const out = formatShortDateTime("2026-10-12T05:37:00Z"); // ঢাকায় ১১:৩৭
    expect(out).toContain("অক্টোবর");
    expect(out).not.toContain("২০২৬");
    expect(out).toContain("১১");
    expect(out).not.toContain(" এ ");
  });
});
