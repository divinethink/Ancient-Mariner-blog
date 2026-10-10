import { describe, expect, it } from "vitest";
import { CONTENT_MAX, NAME_MAX, buildThread, cleanContent, cleanName, countLinks, countThread, looksSpammy, parseCommentPayload, parseOwnerAction, type PublicComment } from "./comments";

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

describe("buildThread (P11b-২)", () => {
  const c = (id: string, t: number, parent?: string): PublicComment => ({ id, authorName: "ক", content: "x", createdAt: new Date(t), parentCommentId: parent });
  it("পুরনো আগে; reply তার parent-এর নিচে, পুরনো আগে", () => {
    const th = buildThread([c("b", 20), c("r2", 40, "a"), c("a", 10), c("r1", 30, "a")]);
    expect(th.map((n) => n.comment.id)).toEqual(["a", "b"]);
    expect(th[0].replies.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(th[1].replies).toEqual([]);
  });
  it("parent নেই/লুকানো (তালিকায় অনুপস্থিত) হলে reply বাদ — অনাথ দেখানো হয় না; গণনায়ও নয়", () => {
    const th = buildThread([c("a", 1), c("orphan", 2, "gone")]);
    expect(th).toHaveLength(1);
    expect(countThread(th)).toBe(1);
  });
  it("একই সময়ে id দিয়ে স্থির ক্রম; খালি ⇒ খালি", () => {
    expect(buildThread([c("b", 5), c("a", 5)]).map((n) => n.comment.id)).toEqual(["a", "b"]);
    expect(buildThread([])).toEqual([]);
    expect(countThread([])).toBe(0);
  });
});

describe("parseOwnerAction (P11b-২)", () => {
  const A = "A".repeat(20);
  const B = "B".repeat(20);
  it("বৈধ: status/delete/reply", () => {
    expect(parseOwnerAction({ action: "status", id: A, status: "spam" })).toEqual({ action: "status", id: A, status: "spam" });
    expect(parseOwnerAction({ action: "status", id: A, status: "approved" })).toEqual({ action: "status", id: A, status: "approved" });
    expect(parseOwnerAction({ action: "delete", id: A })).toEqual({ action: "delete", id: A });
    expect(parseOwnerAction({ action: "reply", commentId: B, parentCommentId: A, content: " ধন্যবাদ \r\n" })).toEqual({ action: "reply", commentId: B, parentCommentId: A, content: "ধন্যবাদ" });
  });
  it("অবৈধ ⇒ null (অন্য status, খারাপ id, খালি/বড় লেখা, parent=নিজে)", () => {
    for (const bad of [null, "x", {}, { action: "status", id: A, status: "pending" }, { action: "status", id: "short", status: "spam" }, { action: "delete" }, { action: "nuke", id: A }, { action: "reply", commentId: B, parentCommentId: A, content: "  " }, { action: "reply", commentId: B, parentCommentId: A, content: "ক".repeat(CONTENT_MAX + 1) }, { action: "reply", commentId: A, parentCommentId: A, content: "ক" }]) {
      expect(parseOwnerAction(bad)).toBeNull();
    }
  });
});
