import { describe, expect, it } from "vitest";
import { diaryShareUrl, shareLinks, whatsappShareUrl } from "./diaryShare";

describe("diaryShare", () => {
  it("diaryShareUrl: দিনের পথ; siteUrl না থাকলে undefined", () => {
    expect(diaryShareUrl("https://ex.com", "2026-10-23")).toBe("https://ex.com/diary/2026-10-23");
    expect(diaryShareUrl("https://ex.com/", "2026-10-23")).toBe("https://ex.com/diary/2026-10-23");
    expect(diaryShareUrl(undefined, "2026-10-23")).toBeUndefined();
  });
  it("whatsapp: encode করা লেখা+লিংক; অনিরাপদ স্কিম null", () => {
    expect(whatsappShareUrl("https://ex.com/diary/2026-10-23", "দিনলিপি")).toBe(`https://wa.me/?text=${encodeURIComponent("দিনলিপি https://ex.com/diary/2026-10-23")}`);
    expect(whatsappShareUrl("javascript:alert(1)", "x")).toBeNull();
    expect(whatsappShareUrl(undefined, "x")).toBeNull();
  });
  it("shareLinks: দুটোই; অবৈধ URL-এ দুটোই null", () => {
    const l = shareLinks("https://ex.com/diary/2026-10-23", "t");
    expect(l.facebook).toContain("facebook.com/sharer");
    expect(l.whatsapp).toContain("wa.me");
    expect(shareLinks("ftp://x", "t")).toEqual({ facebook: null, whatsapp: null });
  });
});
