import { describe, expect, it } from "vitest";
import { SAFE_KEY, cardChunkPath, splitCards, toCardView, type CardPost, type CardView } from "./cards";

const post = (o: Partial<CardPost> = {}): CardPost => ({
  id: "p1",
  title: "শিরোনাম",
  slug: "বাংলা slug",
  excerpt: "নিজের সারাংশ",
  body: "{}",
  publishedAt: new Date("2026-10-04T20:00:00Z"), // ঢাকায় ৫ অক্টোবর ০২:০০
  wordCount: 450,
  tagIds: [],
  tagNames: [],
  ...o,
});
const ctx = {
  timeZone: "Asia/Dhaka",
  categories: new Map([["c1", { id: "c1", slug: "ভ্রমণ" }]]),
  tags: new Map([["t1", { id: "t1", slug: "সমুদ্র" }]]),
};

describe("toCardView", () => {
  it("পথ percent-encoded, পড়ার সময় ceil, সাইট-timezone-এর দিন, body নেই", () => {
    const v = toCardView(post({ categoryId: "c1", categoryName: "ভ্রমণ", tagIds: ["t1", "gone"], tagNames: ["সমুদ্র", "পুরনো"] }), ctx);
    expect(v.href).toBe(`/blog/${encodeURIComponent("বাংলা slug")}`);
    expect(v.minutes).toBe(3);
    expect(v.excerpt).toBe("নিজের সারাংশ");
    expect(v.category).toEqual({ name: "ভ্রমণ", href: `/category/${encodeURIComponent("ভ্রমণ")}` });
    expect(v.tags).toEqual([
      { name: "সমুদ্র", href: `/tag/${encodeURIComponent("সমুদ্র")}` },
      { name: "পুরনো", href: undefined }, // term মোছা — নাম থাকে, লিংক নয়
    ]);
    expect(v.day).toBeTruthy();
    expect(JSON.stringify(v)).not.toContain('"body"');
  });
  it("তারিখ/ক্যাটাগরি না থাকলে সেই ফিল্ড বাদ", () => {
    const v = toCardView(post({ publishedAt: undefined }), ctx);
    expect(v.dateISO).toBeUndefined();
    expect(v.category).toBeUndefined();
  });
});

describe("splitCards", () => {
  const cards = Array.from({ length: 25 }, (_, i) => ({ id: String(i) }) as CardView);
  it("প্রথম পেজ + বাকি chunk", () => {
    const r = splitCards(cards, 10, "blog");
    expect(r.first).toHaveLength(10);
    expect(r.chunks.map((c) => c.length)).toEqual([10, 5]);
    expect(r.chunks[0][0].id).toBe("10");
  });
  it("সব এঁটে গেলে chunk নেই; অনিরাপদ key হলে সব প্রথম পেজে", () => {
    expect(splitCards(cards, 30, "blog").chunks).toEqual([]);
    const u = splitCards(cards, 10, "c-বাংলা");
    expect(u.first).toHaveLength(25);
    expect(u.chunks).toEqual([]);
  });
  it("chunk-পথ ও key-নিয়ম", () => {
    expect(cardChunkPath("c-abc_1", 2)).toBe("/data/cards/c-abc_1-2.json");
    expect(SAFE_KEY.test("t-AbC-9")).toBe(true);
    expect(SAFE_KEY.test("a/b")).toBe(false);
  });
});
