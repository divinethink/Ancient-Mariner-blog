import { describe, expect, it } from "vitest";
import { addDays, bucketLabel, countryLabel, fillBuckets, isStatsRange, pctChange, referrerLabel, statsWindow, toCount } from "./stats";

// ২০২৬-১০-১০ ১২:০০ UTC = ঢাকায় ১৮:০০, একই দিন
const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);

describe("addDays", () => {
  it("মাস/বছর পেরোয়, লিপ-বছরও", () => {
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});

describe("statsWindow", () => {
  it("সাইট-timezone: UTC রাত ১০টা = ঢাকায় পরদিন", () => {
    const w = statsWindow("today", Date.UTC(2026, 9, 10, 22, 0, 0), "Asia/Dhaka");
    expect(w.from).toBe("2026-10-11");
    expect(w.prev).toEqual({ from: "2026-10-10", to: "2026-10-10" });
  });
  it("৭ দিন ও আগের ৭ দিন পাশাপাশি, ফাঁক/overlap নেই", () => {
    const w = statsWindow("7d", NOW, "Asia/Dhaka");
    expect([w.from, w.to]).toEqual(["2026-10-04", "2026-10-10"]);
    expect(w.prev).toEqual({ from: "2026-09-27", to: "2026-10-03" });
    expect(w.bucket).toBe("day");
  });
  it("৩০ দিন", () => {
    const w = statsWindow("30d", NOW, "Asia/Dhaka");
    expect([w.from, w.to]).toEqual(["2026-09-11", "2026-10-10"]);
    expect(w.prev).toEqual({ from: "2026-08-12", to: "2026-09-10" });
  });
  it("১২ মাস = চলতি মাসসহ, মাসের শুরু থেকে; মাসভিত্তিক", () => {
    const w = statsWindow("12m", NOW, "Asia/Dhaka");
    expect([w.from, w.to]).toEqual(["2025-11-01", "2026-10-10"]);
    expect(w.prev).toEqual({ from: "2024-11-01", to: "2025-10-31" });
    expect(w.bucket).toBe("month");
  });
  it("সব সময়: তুলনা নেই", () => {
    const w = statsWindow("all", NOW, "Asia/Dhaka");
    expect(w.prev).toBeNull();
    expect(w.to).toBe("2026-10-10");
  });
});

describe("pctChange", () => {
  it("কমা/বাড়া (পূর্ণসংখ্যা)", () => {
    expect(pctChange(34, 49)).toBe(-31);
    expect(pctChange(150, 100)).toBe(50);
  });
  it("আগের মান ০/নেই ⇒ null", () => {
    expect(pctChange(5, 0)).toBeNull();
    expect(pctChange(5, null)).toBeNull();
    expect(pctChange(5, undefined)).toBeNull();
  });
});

describe("fillBuckets", () => {
  it("দিনভিত্তিক: ফাঁকা দিন ০", () => {
    const w = statsWindow("7d", NOW, "Asia/Dhaka");
    const out = fillBuckets([{ k: "2026-10-05", n: 3 }], w);
    expect(out).toHaveLength(7);
    expect(out[1]).toEqual({ k: "2026-10-05", n: 3 });
    expect(out.reduce((s, p) => s + p.n, 0)).toBe(3);
  });
  it("১২ মাস: ১২টা মাস-key", () => {
    const out = fillBuckets([{ k: "2026-09", n: 4 }], statsWindow("12m", NOW, "Asia/Dhaka"));
    expect(out).toHaveLength(12);
    expect(out[0]!.k).toBe("2025-11");
    expect(out[11]!.k).toBe("2026-10");
    expect(out.find((p) => p.k === "2026-09")?.n).toBe(4);
  });
  it("সব সময়: প্রথম ডেটার মাস থেকে; ডেটা না থাকলে খালি", () => {
    const w = statsWindow("all", NOW, "Asia/Dhaka");
    expect(fillBuckets([], w)).toEqual([]);
    const out = fillBuckets([{ k: "2026-08", n: 2 }], w);
    expect(out.map((p) => p.k)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });
});

describe("লেবেল", () => {
  it("referrer: পরিচিত ডোমেইন সহজ নামে; direct = সরাসরি; অচেনা = ডোমেইন", () => {
    expect(referrerLabel("direct")).toBe("সরাসরি");
    expect(referrerLabel("")).toBe("সরাসরি");
    expect(referrerLabel("google.com")).toBe("Google");
    expect(referrerLabel("google.com.bd")).toBe("Google");
    expect(referrerLabel("m.facebook.com")).toBe("Facebook");
    expect(referrerLabel("l.facebook.com")).toBe("Facebook");
    expect(referrerLabel("blog.example.org")).toBe("blog.example.org");
  });
  it("দেশ: XX/অবৈধ = অজানা; বৈধ কোডে নাম (বা কোড)", () => {
    expect(countryLabel("XX")).toBe("অজানা");
    expect(countryLabel("zzz")).toBe("অজানা");
    expect(countryLabel("BD").length).toBeGreaterThan(0);
    expect(countryLabel("bd")).toBe(countryLabel("BD"));
  });
});

describe("toCount / isStatsRange", () => {
  it("অ-সংখ্যা/ঋণাত্মক ⇒ ০", () => {
    expect(toCount("12")).toBe(12);
    expect(toCount(null)).toBe(0);
    expect(toCount(-4)).toBe(0);
    expect(toCount(NaN)).toBe(0);
  });
  it("range যাচাই", () => {
    expect(isStatsRange("7d")).toBe(true);
    expect(isStatsRange("1y")).toBe(false);
    expect(isStatsRange(undefined)).toBe(false);
  });
});

describe("bucketLabel", () => {
  it("দিন ও মাস-key বাংলায়; দিন সরে না", () => {
    expect(bucketLabel("2026-10-10", "day")).toContain("১০");
    expect(bucketLabel("2026-10-01", "day")).toContain("১");
    expect(bucketLabel("2026-10", "month")).toContain("২০২৬");
    expect(bucketLabel("bad", "day")).toBe("bad");
  });
});
