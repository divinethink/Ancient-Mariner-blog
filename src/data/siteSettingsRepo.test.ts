import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SiteSettingsInputSchema, parseSiteSettings } from "./siteSettingsRepo";

const valid = { ...DEFAULT_SETTINGS, siteTitle: "আমার ব্লগ", tagline: "জোনাক পোকা", postsPerPage: 12 };

describe("DEFAULT_SETTINGS", () => {
  it("fail-closed: ইনডেক্স ও AI-block ডিফল্টে বন্ধ-ইনডেক্স/খোলা-crawler নীতি", () => {
    expect(DEFAULT_SETTINGS.allowIndexing).toBe(false);
    expect(DEFAULT_SETTINGS.blockAiCrawlers).toBe(false);
    expect(DEFAULT_SETTINGS.timezone).toBe("Asia/Dhaka");
    expect(DEFAULT_SETTINGS.postsPerPage).toBe(10);
  });
});

describe("parseSiteSettings (defensive read)", () => {
  it("doc নেই/অবৈধ ধরন → সব default", () => {
    expect(parseSiteSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSiteSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSiteSettings("x")).toEqual(DEFAULT_SETTINGS);
  });
  it("বৈধ মান থাকে, অজানা ফিল্ড (menu…) বাদ", () => {
    const r = parseSiteSettings({ ...valid, menu: [{ label: "x" }], allowIndexing: true });
    expect(r.siteTitle).toBe("আমার ব্লগ");
    expect(r.allowIndexing).toBe(true);
    expect(r).not.toHaveProperty("menu");
  });
  it("শুধু অবৈধ ফিল্ড default-এ ফেরে, বাকি অক্ষত", () => {
    const r = parseSiteSettings({ ...valid, timezone: "Mars/Base", postsPerPage: 999, defaultTheme: "neon" });
    expect(r.timezone).toBe("Asia/Dhaka");
    expect(r.postsPerPage).toBe(10);
    expect(r.defaultTheme).toBe("light");
    expect(r.siteTitle).toBe("আমার ব্লগ");
  });
});

describe("SiteSettingsInputSchema (সেভ-যাচাই)", () => {
  it("বৈধ মান পাস; নাম/ট্যাগলাইন trim", () => {
    const r = SiteSettingsInputSchema.parse({ ...valid, siteTitle: "  নাম  " });
    expect(r.siteTitle).toBe("নাম");
  });
  it.each([
    ["খালি নাম", { siteTitle: "   " }],
    ["লম্বা নাম", { siteTitle: "ক".repeat(81) }],
    ["লম্বা ট্যাগলাইন", { tagline: "ক".repeat(161) }],
    ["postsPerPage ৪", { postsPerPage: 4 }],
    ["postsPerPage ৩১", { postsPerPage: 31 }],
    ["postsPerPage দশমিক", { postsPerPage: 10.5 }],
    ["postsPerPage NaN", { postsPerPage: NaN }],
    ["অবৈধ timezone", { timezone: "Mars/Base" }],
    ["অবৈধ থিম", { defaultTheme: "neon" }],
    ["boolean নয়", { allowIndexing: "true" }],
  ])("%s নাকচ", (_n, over) => {
    expect(SiteSettingsInputSchema.safeParse({ ...valid, ...over }).success).toBe(false);
  });
});
