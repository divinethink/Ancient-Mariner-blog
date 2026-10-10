import { describe, expect, it } from "vitest";
import { CONTENT_MAX, NAME_MAX, cleanContent, cleanName, countLinks, looksSpammy, parseCommentPayload } from "./comments";

const ID = "A".repeat(20);
const ok = (o: Record<string, unknown> = {}) => ({ commentId: ID, postId: "P1", authorName: "রহিম", content: "চমৎকার লেখা", turnstileToken: "tok", ...o });

describe("parseCommentPayload", () => {
  it("বৈধ payload", () => {
    expect(parseCommentPayload(ok())).toEqual({ commentId: ID, postId: "P1", parentCommentId: undefined, authorName: "রহিম", content: "চমৎকার লেখা", turnstileToken: "tok" });
  });
  it("নাম/লেখা পরিষ্কার: ফাঁকা, নিয়ন্ত্রণ/bidi অক্ষর, বাড়তি ফাঁকা লাইন", () => {
    const p = parseCommentPayload(ok({ authorName: "  রহিম ‮  উদ্দিন\u0000 ", content: "ক\r\n\r\n\r\n\r\nখ  \n" }));
    expect(p?.authorName).toBe("রহিম উদ্দিন");
    expect(p?.content).toBe("ক\n\nখ");
  });
  it("অবৈধ আকার ⇒ null", () => {
    for (const bad of [null, "x", [], ok({ commentId: "short" }), ok({ postId: "a/b" }), ok({ authorName: " " }), ok({ content: "\n \t" }), ok({ turnstileToken: "" }), ok({ authorName: 5 }), ok({ parentCommentId: 7 }), ok({ parentCommentId: ID })]) {
      expect(parseCommentPayload(bad)).toBeNull();
    }
  });
  it("সীমা: নাম ≤৬০, লেখা ≤২০০০ (পরিষ্কারের পরে মাপা)", () => {
    expect(parseCommentPayload(ok({ authorName: "ক".repeat(NAME_MAX) }))).not.toBeNull();
    expect(parseCommentPayload(ok({ authorName: "ক".repeat(NAME_MAX + 1) }))).toBeNull();
    expect(parseCommentPayload(ok({ content: "ক".repeat(CONTENT_MAX) }))).not.toBeNull();
    expect(parseCommentPayload(ok({ content: "ক".repeat(CONTENT_MAX + 1) }))).toBeNull();
  });
  it("parentCommentId: ঐচ্ছিক; খালি-string = নেই; বৈধ ID রাখা", () => {
    expect(parseCommentPayload(ok({ parentCommentId: "" }))?.parentCommentId).toBeUndefined();
    expect(parseCommentPayload(ok({ parentCommentId: "B".repeat(20) }))?.parentCommentId).toBe("B".repeat(20));
  });
  it("HTML অক্ষত plain-text হিসেবে থাকে (render-এ escape)", () => {
    expect(parseCommentPayload(ok({ content: "<script>alert(1)</script>" }))?.content).toBe("<script>alert(1)</script>");
  });
});

describe("cleanName/cleanContent", () => {
  it("NFC normalize", () => expect(cleanName("é")).toBe("é"));
  it("অনুচ্ছেদ-ফাঁক সর্বোচ্চ একটা", () => expect(cleanContent("a\n\n\n\nb")).toBe("a\n\nb"));
});

describe("looksSpammy", () => {
  it("লিংক গণনা", () => expect(countLinks("http://a.com www.b.com https://c.org")).toBe(3));
  it("≤২ লিংক ঠিক; ৩+ spam; নামে যেকোনো লিংক spam", () => {
    expect(looksSpammy("রহিম", "দেখুন https://a.com ও www.b.com")).toBe(false);
    expect(looksSpammy("রহিম", "http://a.com http://b.com http://c.com")).toBe(true);
    expect(looksSpammy("www.buy-now.com", "ভালো")).toBe(true);
  });
});
