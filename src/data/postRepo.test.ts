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
      ["contentType", "excerpt", "id", "publishedAt", "slug", "title", "wordCount"].sort(),
    );
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
