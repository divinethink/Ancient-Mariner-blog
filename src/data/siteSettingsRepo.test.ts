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
  it("বৈধ মান থাকে, অজানা ফিল্ড বাদ", () => {
    const r = parseSiteSettings({ ...valid, notAField: [{ label: "x" }], allowIndexing: true });
    expect(r.siteTitle).toBe("আমার ব্লগ");
    expect(r.allowIndexing).toBe(true);
    expect(r).not.toHaveProperty("notAField");
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

describe("P4b-২ ফিল্ড: authorBio, feedItems, feedMode", () => {
  it("default: bio খালি, ১০টি, full — পুরনো doc-এ ফিল্ড না থাকলেও", () => {
    const r = parseSiteSettings({ siteTitle: "ব্লগ" });
    expect(r.authorBio).toBe("");
    expect(r.feedItems).toBe(10);
    expect(r.feedMode).toBe("full");
  });
  it("অবৈধ মান শুধু সেই ফিল্ডে default-এ ফেরে", () => {
    const r = parseSiteSettings({ ...valid, authorBio: "ক".repeat(201), feedItems: 4, feedMode: "html" });
    expect(r.authorBio).toBe("");
    expect(r.feedItems).toBe(10);
    expect(r.feedMode).toBe("full");
    expect(r.postsPerPage).toBe(12);
  });
  it("কঠোর input: সীমার বাইরে প্রত্যাখ্যান; সীমায় গ্রহণ ও bio trim", () => {
    expect(SiteSettingsInputSchema.safeParse({ ...valid, feedItems: 51 }).success).toBe(false);
    expect(SiteSettingsInputSchema.safeParse({ ...valid, feedItems: 5.5 }).success).toBe(false);
    expect(SiteSettingsInputSchema.safeParse({ ...valid, feedMode: "x" }).success).toBe(false);
    expect(SiteSettingsInputSchema.safeParse({ ...valid, authorBio: "ক".repeat(201) }).success).toBe(false);
    const ok = SiteSettingsInputSchema.parse({ ...valid, authorBio: "  আমি  ", feedItems: 50, feedMode: "excerpt" });
    expect(ok.authorBio).toBe("আমি");
  });
});

describe("P4b-৩ ফিল্ড: socialLinks, links, layout", () => {
  it("default: ফেসবুক খালি, লিংক ফাঁকা, layout ফাঁকা — পুরনো doc-এ না থাকলেও", () => {
    const r = parseSiteSettings({ siteTitle: "ব্লগ" });
    expect(r.socialLinks).toEqual({ facebook: "" });
    expect(r.links).toEqual([]);
    expect(r.layout).toEqual({ sidebar: [], home: [] });
  });
  it("অনিরাপদ URL (javascript:/data:) শুধু সেই ফিল্ডকে default-এ ফেরায়", () => {
    const r = parseSiteSettings({ ...valid, socialLinks: { facebook: "javascript:alert(1)" }, links: [{ label: "x", url: "data:text/html,hi" }] });
    expect(r.socialLinks.facebook).toBe("");
    expect(r.links).toEqual([]);
    expect(r.postsPerPage).toBe(12);
  });
  it("http/https গ্রহণ, লেবেল trim; layout আকৃতি ঠিক থাকলে রাখে", () => {
    const ok = SiteSettingsInputSchema.parse({
      ...valid,
      socialLinks: { facebook: "https://facebook.com/page" },
      links: [{ label: " প্রথম আলো ", url: "https://prothomalo.com" }],
      layout: { sidebar: [{ id: "recent", enabled: true }], home: [] },
    });
    expect(ok.links[0]?.label).toBe("প্রথম আলো");
    expect(ok.layout.sidebar).toEqual([{ id: "recent", enabled: true }]);
    expect(SiteSettingsInputSchema.safeParse({ ...valid, links: Array.from({ length: 21 }, () => ({ label: "a", url: "https://a.dev" })) }).success).toBe(false);
  });
});

describe("P9a-১ ফিল্ড: menu, footer", () => {
  it("default: দুটোই খালি — পুরনো doc-এ না থাকলেও (আগের মেনু/footer অক্ষত)", () => {
    const r = parseSiteSettings({ siteTitle: "x" });
    expect(r.menu).toEqual([]);
    expect(r.footer).toEqual({ text: "", links: [] });
  });
  it("বৈধ মেনু/footer গ্রহণ, trim", () => {
    const ok = SiteSettingsInputSchema.parse({
      ...valid,
      menu: [
        { label: " নীড় ", type: "link", ref: "/" },
        { label: "আমি", type: "page", ref: "about" },
        { label: "গল্প", type: "category", ref: "c1" },
      ],
      footer: { text: " আমার সাইট ", links: [{ label: "x", url: "/privacy" }, { label: "y", url: "https://a.dev" }] },
    });
    expect(ok.menu[0]?.label).toBe("নীড়");
    expect(ok.footer.text).toBe("আমার সাইট");
  });
  it("অবৈধ ref/URL/সীমা আটকায়", () => {
    const bad = (menu: unknown, footer?: unknown) => SiteSettingsInputSchema.safeParse({ ...valid, menu, ...(footer ? { footer } : {}) }).success;
    expect(bad([{ label: "a", type: "link", ref: "javascript:alert(1)" }])).toBe(false);
    expect(bad([{ label: "a", type: "page", ref: "a b" }])).toBe(false);
    expect(bad([{ label: "a", type: "nope", ref: "x" }])).toBe(false);
    expect(bad(Array.from({ length: 13 }, () => ({ label: "a", type: "link", ref: "/" })))).toBe(false);
    expect(bad([], { text: "", links: [{ label: "a", url: "data:x" }] })).toBe(false);
    expect(bad([], { text: "x".repeat(201), links: [] })).toBe(false);
  });
  it("সংরক্ষিত মান অবৈধ হলে শুধু সেই ফিল্ড default-এ ফেরে, বাকিরা অক্ষত", () => {
    const r = parseSiteSettings({ ...valid, menu: [{ label: "a", type: "link", ref: "javascript:1" }], footer: { text: "ok", links: [] } });
    expect(r.menu).toEqual([]);
    expect(r.footer.text).toBe("ok");
    expect(r.siteTitle).toBe("আমার ব্লগ");
  });
});

describe("design (P9b)", () => {
  it("doc-এ না থাকলে ডিফল্ট; অজানা উপ-ফিল্ড শুধু নিজে ডিফল্টে — বাকি বৈধ মান থাকে", () => {
    expect(parseSiteSettings({ siteTitle: "x" }).design).toEqual(DEFAULT_SETTINGS.design);
    const r = parseSiteSettings({ design: { accent: "teal", fontPair: "comic", cardStyle: "flat", logoMediaId: "abc", bannerMediaId: 5 } });
    expect(r.design).toEqual({ ...DEFAULT_SETTINGS.design, accent: "teal", fontPair: "serif-sans", cardStyle: "flat", logoMediaId: "abc", bannerMediaId: "" });
    // নাম/স্লোগানের ফন্ট-সাইজ: অনুপস্থিত/অজানা = ডিফল্ট, বৈধ = রাখে
    expect(parseSiteSettings({ design: { palette: "nord" } }).design.palette).toBe("nord");
    expect(parseSiteSettings({ design: { palette: "neon" } }).design.palette).toBe("classic");
    expect(parseSiteSettings({ design: { accent: "teal" } }).design.palette).toBe("classic"); // পুরনো ডক
    expect(parseSiteSettings({ design: { titleFont: "hind", titleSize: "xl", taglineSize: "lg" } }).design).toMatchObject({ titleFont: "hind", titleSize: "md", taglineFont: "theme", taglineSize: "lg" });
  });
  it("সেভ-যাচাই: logo/banner id ডিফল্ট খালি", () => {
    const r = SiteSettingsInputSchema.safeParse({ ...valid, design: { ...DEFAULT_SETTINGS.design, logoMediaId: "blog-1" } });
    expect(r.success && r.data.design.logoMediaId).toBe("blog-1");
  });
});

describe("subscribeUrl (ইমেইল-সাবস্ক্রাইব)", () => {
  const ok = "https://api.follow.it/subscription-form/AbC123/8";
  it("পুরনো doc-এ নেই ⇒ crash নয়, ফর্ম লুকানো (খালি/undefined)", () => {
    expect(parseSiteSettings({}).subscribeUrl ?? "").toBe("");
    expect(SiteSettingsInputSchema.safeParse(valid).success).toBe(true);
  });
  it("নেই হলে key-ই থাকে না (Firestore undefined নেয় না)", () => {
    expect("subscribeUrl" in parseSiteSettings({})).toBe(false);
  });
  it("বৈধ follow.it ঠিকানা রাখে; অন্য host/অবৈধ মান পড়ায় বাদ, সেভে প্রত্যাখ্যান", () => {
    expect(parseSiteSettings({ ...valid, subscribeUrl: ` ${ok} ` }).subscribeUrl).toBe(ok);
    expect(parseSiteSettings({ ...valid, subscribeUrl: "https://evil.com/x" }).subscribeUrl ?? "").toBe("");
    expect(SiteSettingsInputSchema.safeParse({ ...valid, subscribeUrl: "https://evil.com/x" }).success).toBe(false);
    expect(SiteSettingsInputSchema.safeParse({ ...valid, subscribeUrl: "" }).success).toBe(true);
    expect(SiteSettingsInputSchema.parse({ ...valid, subscribeUrl: ok }).subscribeUrl).toBe(ok);
  });
});

describe("subscribeLink (সাবস্ক্রাইব-পেজের লিংক)", () => {
  const ok = "https://follow.it/abc-def";
  it("নেই হলে key-ই থাকে না; বৈধ লিংক রাখে; অন্য host প্রত্যাখ্যান", () => {
    expect("subscribeLink" in parseSiteSettings({})).toBe(false);
    expect(parseSiteSettings({ ...valid, subscribeLink: ok }).subscribeLink).toBe(ok);
    expect(parseSiteSettings({ ...valid, subscribeLink: "https://evil.com/x" }).subscribeLink ?? "").toBe("");
    expect(SiteSettingsInputSchema.safeParse({ ...valid, subscribeLink: "https://evil.com/x" }).success).toBe(false);
    expect(SiteSettingsInputSchema.safeParse({ ...valid, subscribeLink: "" }).success).toBe(true);
  });
});
