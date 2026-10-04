import { describe, expect, it } from "vitest";
import { dayKey, formatDate } from "./datetime";

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
