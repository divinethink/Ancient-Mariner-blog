import { describe, expect, it } from "vitest";
import {
  DraftSchema,
  normalizeRaw,
  parsePost,
  PostPatchSchema,
  toPostCard,
} from "./postRepo";

const T = new Date("2026-10-05T00:00:00Z");
const raw = (o: Record<string, unknown> = {}) => ({
  title: "শিরোনাম",
  slug: "শিরোনাম",
  body: "{}",
  status: "published",
  visibility: "public",
  ownerUid: "u1",
  createdAt: T,
  updatedAt: T,
  ...o,
});

describe("parsePost (defensive read)", () => {
  it("পুরনো doc-এ নতুন field না থাকলে default বসে", () => {
    const p = parsePost("id1", raw());
    expect(p.id).toBe("id1");
    expect(p.slugHistory).toEqual([]);
    expect(p.excerpt).toBe("");
    expect(p.wordCount).toBe(0);
    expect(p.contentType).toBe("post");
    expect(p.schemaVersion).toBe(1);
  });
  it("Timestamp-সদৃশ ও ISO string → Date; null বাদ", () => {
    const p = parsePost(
      "id1",
      raw({ publishedAt: { toDate: () => T }, trashedAt: null, createdAt: "2026-10-05T00:00:00Z" }),
    );
    expect(p.publishedAt).toEqual(T);
    expect(p.trashedAt).toBeUndefined();
    expect(p.createdAt).toEqual(T);
  });
  it("অবৈধ enum/অনুপস্থিত আবশ্যিক field-এ ব্যর্থ", () => {
    expect(() => parsePost("i", raw({ status: "bogus" }))).toThrow();
    expect(() => parsePost("i", raw({ ownerUid: undefined }))).toThrow();
  });
  it("body > ~৯০০ KB (UTF-8 byte) ব্যর্থ; বাংলা ৩ byte/অক্ষর", () => {
    expect(() => parsePost("i", raw({ body: "ক".repeat(310_000) }))).toThrow(); // ≈ ৯৩০ KB
    expect(() => parsePost("i", raw({ body: "ক".repeat(290_000) }))).not.toThrow(); // ≈ ৮৭০ KB
  });
});

describe("toPostCard", () => {
  it("body ও ownerUid যায় না", () => {
    const card = toPostCard(parsePost("id1", raw()));
    expect(card).not.toHaveProperty("body");
    expect(card).not.toHaveProperty("ownerUid");
    expect(Object.keys(card).sort()).toEqual(
      [
        "categoryId",
        "categoryName",
        "contentType",
        "excerpt",
        "id",
        "publishedAt",
        "seriesId",
        "seriesOrder",
        "slug",
        "tagIds",
        "tagNames",
        "title",
        "wordCount",
      ].sort(),
    );
  });
  it("সংগঠন-ফিল্ড card-এ থাকে (P3a-৩; P4a-র card/filter-এর জন্য), পুরনো doc-এ খালি", () => {
    const full = toPostCard(
      parsePost(
        "id1",
        raw({ categoryId: "c1", categoryName: "ভ্রমণ", tagIds: ["t1"], tagNames: ["সমুদ্র"], seriesId: "s1", seriesOrder: 2 }),
      ),
    );
    expect(full).toMatchObject({ categoryId: "c1", categoryName: "ভ্রমণ", tagIds: ["t1"], tagNames: ["সমুদ্র"], seriesId: "s1", seriesOrder: 2 });
    const old = toPostCard(parsePost("id2", raw()));
    expect(old.categoryId).toBeUndefined();
    expect(old.tagIds).toEqual([]);
  });
});

describe("PostPatchSchema", () => {
  it("আংশিক patch-এ default ঢোকে না", () => {
    expect(PostPatchSchema.parse({ title: "x" })).toEqual({ title: "x" });
    expect(PostPatchSchema.parse({})).toEqual({});
  });
  it("অবৈধ মান ব্যর্থ", () => {
    expect(() => PostPatchSchema.parse({ status: "x" })).toThrow();
    expect(() => PostPatchSchema.parse({ wordCount: -1 })).toThrow();
  });
});

describe("DraftSchema / normalizeRaw", () => {
  it("draft parse", () => {
    const d = DraftSchema.parse({ title: "t", body: "{}", ownerUid: "u", updatedAt: T });
    expect(d.targetType).toBe("post");
    expect(d.excerpt).toBe("");
  });
  it("normalizeRaw undefined বাদ দেয়", () => {
    expect(normalizeRaw({ a: undefined, b: 1 })).toEqual({ b: 1 });
  });
});

describe("P3a সংগঠন-ফিল্ড", () => {
  it("পুরনো doc-এ নেই → tagIds/tagNames [], বাকি optional; নতুন ফিল্ড পড়ে", () => {
    const old = parsePost("a", raw());
    expect(old.tagIds).toEqual([]);
    expect(old.tagNames).toEqual([]);
    expect(old.categoryId).toBeUndefined();
    const p = parsePost("b", raw({ categoryId: "c", categoryName: "ভ্রমণ", tagIds: ["t"], tagNames: ["x"], seriesId: "s", seriesOrder: 2, contentType: "travel" }));
    expect(p).toMatchObject({ categoryId: "c", categoryName: "ভ্রমণ", tagIds: ["t"], seriesId: "s", seriesOrder: 2, contentType: "travel" });
  });
  it("patch: null অনুমোদিত (clear); জোড়া-নিয়ম ও দৈর্ঘ্য-সীমা", () => {
    expect(PostPatchSchema.parse({ seriesId: null, seriesOrder: null })).toEqual({ seriesId: null, seriesOrder: null });
    expect(PostPatchSchema.parse({ categoryId: null, categoryName: null })).toEqual({ categoryId: null, categoryName: null });
    expect(() => PostPatchSchema.parse({ tagIds: ["a"] })).toThrow();
    expect(() => PostPatchSchema.parse({ tagIds: ["a"], tagNames: [] })).toThrow();
    expect(() => PostPatchSchema.parse({ categoryId: "c" })).toThrow();
    expect(() => PostPatchSchema.parse({ contentType: "novel" })).toThrow();
    const many = Array.from({ length: 21 }, (_, i) => `t${i}`);
    expect(() => PostPatchSchema.parse({ tagIds: many, tagNames: many })).toThrow();
  });
});

describe("P3c-খ importSource (additive, defensive read)", () => {
  it("না থাকলে undefined; আছে — Timestamp-সদৃশ/ISO-string তারিখ Date হয়, default খালি তালিকা", () => {
    expect(parsePost("i", raw()).importSource).toBeUndefined();
    const a = parsePost("i", raw({ importSource: { site: "s", wpPostId: "1", originalDate: { toDate: () => T } } }));
    expect(a.importSource).toMatchObject({ site: "s", wpPostId: "1", originalDate: T, categories: [], tags: [] });
    const b = parsePost("i", raw({ importSource: { site: "s", wpPostId: "1", originalDate: "2026-10-05T00:00:00Z" } }));
    expect(b.importSource?.originalDate).toEqual(T);
  });
  it("বিকৃত importSource লেখা ভাঙে না — শুধু বাদ পড়ে", () => {
    const p = parsePost("i", raw({ importSource: { site: "", wpPostId: 5 } }));
    expect(p.importSource).toBeUndefined();
    expect(p.title).toBe("শিরোনাম");
  });
});

describe("featured (P4b-৩)", () => {
  it("পুরনো doc-এ নেই = undefined; true/false রাখে; বিকৃত মান পড়া ভাঙে না (বাদ); patch কঠোর", () => {
    expect(parsePost("id1", raw()).featured).toBeUndefined();
    expect(parsePost("id1", raw({ featured: true })).featured).toBe(true);
    expect(parsePost("id1", raw({ featured: "yes" })).featured).toBeUndefined();
    expect(PostPatchSchema.safeParse({ featured: false }).success).toBe(true);
    expect(PostPatchSchema.safeParse({ featured: "yes" }).success).toBe(false);
  });
});
