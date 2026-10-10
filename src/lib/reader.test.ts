import { describe, expect, it } from "vitest";
import { absoluteUrl, cleanQuote, facebookQuoteUrl, facebookShareUrl, quotePopupPos, quoteShareText, resolveReaderFont, resolveReaderSize } from "./reader";

describe("resolveReaderSize", () => {
  it("বৈধ মান থাকে, অবৈধ → m", () => {
    expect(resolveReaderSize("l")).toBe("l");
    expect(resolveReaderSize("xl")).toBe("m");
    expect(resolveReaderSize(null)).toBe("m");
  });
});
describe("facebookShareUrl", () => {
  it("encode করা sharer লিংক", () => {
    expect(facebookShareUrl("https://a.com/blog/x")).toBe("https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fa.com%2Fblog%2Fx");
  });
  it("অবৈধ/js:/খালি → null", () => {
    expect(facebookShareUrl(undefined)).toBeNull();
    expect(facebookShareUrl("javascript:alert(1)")).toBeNull();
    expect(facebookShareUrl("nope")).toBeNull();
  });
});
describe("absoluteUrl", () => {
  it("siteUrl + path", () => {
    expect(absoluteUrl("https://a.com", "/blog/x")).toBe("https://a.com/blog/x");
    expect(absoluteUrl(undefined, "/blog/x")).toBeUndefined();
  });
});

describe("resolveReaderFont", () => {
  it("বৈধ id থাকে, বাকি সব → খালি (সাইটের ফন্ট)", () => {
    expect(resolveReaderFont("kalpurush")).toBe("kalpurush");
    expect(resolveReaderFont("comic")).toBe("");
    expect(resolveReaderFont(null)).toBe("");
    expect(resolveReaderFont("__proto__")).toBe("");
  });
});
describe("উদ্ধৃতি-শেয়ার", () => {
  it("cleanQuote: whitespace গোটানো; সীমার বাইরে null", () => {
    expect(cleanQuote("  সাগরের   কাছে\nগেলে বোঝা যায়  ")).toBe("সাগরের কাছে গেলে বোঝা যায়");
    expect(cleanQuote("ছোট")).toBeNull();
    expect(cleanQuote("ক".repeat(601))).toBeNull();
    expect(cleanQuote("ক".repeat(600))).not.toBeNull();
    expect(cleanQuote("   ")).toBeNull();
  });
  it("quoteShareText: লিংক থাকলে নতুন লাইনে, নইলে বাদ", () => {
    expect(quoteShareText("উদ্ধৃতি-লেখা", "শিরোনাম", "https://a.com/x")).toBe("\u201Cউদ্ধৃতি-লেখা\u201D \u2014 শিরোনাম\nhttps://a.com/x");
    expect(quoteShareText("উদ্ধৃতি-লেখা", "শিরোনাম")).toBe("\u201Cউদ্ধৃতি-লেখা\u201D \u2014 শিরোনাম");
  });
  it("facebookQuoteUrl: encode-সহ; অবৈধ URL → null", () => {
    const u = facebookQuoteUrl("https://a.com/x", "a&b=c");
    expect(u).toContain("sharer.php?u=https%3A%2F%2Fa.com%2Fx&quote=a%26b%3Dc");
    expect(facebookQuoteUrl(undefined, "abc")).toBeNull();
    expect(facebookQuoteUrl("javascript:alert(1)", "abc")).toBeNull();
  });
  it("quotePopupPos: ডেস্কটপে ওপরে, জায়গা না থাকলে নিচে; টাচে নিচে; সবসময় viewport-এর ভেতরে", () => {
    const r = { top: 300, bottom: 320, left: 100, right: 200 };
    expect(quotePopupPos(r, 1000, 800, false).top).toBe(244);
    expect(quotePopupPos({ ...r, top: 20, bottom: 40 }, 1000, 800, false).top).toBe(48);
    expect(quotePopupPos(r, 1000, 800, true).top).toBe(348);
    const edge = quotePopupPos({ top: 300, bottom: 320, left: 0, right: 20 }, 390, 800, false);
    expect(edge.left).toBe(8);
    const right = quotePopupPos({ top: 300, bottom: 320, left: 380, right: 390 }, 390, 800, false);
    expect(right.left).toBeLessThanOrEqual(390 - 200 - 8);
    const bottom = quotePopupPos({ top: 760, bottom: 790, left: 100, right: 200 }, 1000, 800, true);
    expect(bottom.top + 48).toBeLessThanOrEqual(800 - 8);
  });
});
