import { describe, expect, it } from "vitest";
import { addTag, orgFromPost, orgPatch, parseSeriesOrder, type OrgState } from "./postOrg";

const base: OrgState = {
  contentType: "post",
  categoryId: null,
  categoryName: null,
  tags: [],
  seriesId: null,
  seriesOrder: null,
};

describe("orgFromPost", () => {
  it("পুরনো পোস্ট (ফিল্ড নেই) → খালি অবস্থা", () =>
    expect(orgFromPost({ contentType: "post", tagIds: [], tagNames: [] })).toEqual(base));
  it("id/নাম জোড়া মেলে", () => {
    const o = orgFromPost({
      contentType: "travel",
      categoryId: "c1",
      categoryName: "ভ্রমণ",
      tagIds: ["t1", "t2"],
      tagNames: ["সমুদ্র", "ছুটি"],
      seriesId: "s1",
      seriesOrder: 3,
    });
    expect(o.tags).toEqual([
      { id: "t1", name: "সমুদ্র" },
      { id: "t2", name: "ছুটি" },
    ]);
    expect(o).toMatchObject({ categoryId: "c1", categoryName: "ভ্রমণ", seriesId: "s1", seriesOrder: 3 });
  });
});

describe("orgPatch", () => {
  it("কিছু না বদলালে {}", () => expect(orgPatch(base, { ...base })).toEqual({}));
  it("ক্যাটাগরি id+নাম জোড়ায়", () =>
    expect(orgPatch(base, { ...base, categoryId: "c", categoryName: "ভ্রমণ" })).toEqual({
      categoryId: "c",
      categoryName: "ভ্রমণ",
    }));
  it("ক্যাটাগরি সরালে দুটোই null", () =>
    expect(orgPatch({ ...base, categoryId: "c", categoryName: "ভ্রমণ" }, base)).toEqual({
      categoryId: null,
      categoryName: null,
    }));
  it("ট্যাগ বদলালে tagIds ও tagNames একসাথে; শুধু ক্রম বদলালেও", () => {
    const a = { ...base, tags: [{ id: "1", name: "ক" }, { id: "2", name: "খ" }] };
    const b = { ...base, tags: [{ id: "2", name: "খ" }, { id: "1", name: "ক" }] };
    expect(orgPatch(a, b)).toEqual({ tagIds: ["2", "1"], tagNames: ["খ", "ক"] });
    expect(orgPatch(a, { ...base, tags: [] })).toEqual({ tagIds: [], tagNames: [] });
  });
  it("সিরিজ: বসানো/পর্ব বদল/সরালে order-ও null", () => {
    expect(orgPatch(base, { ...base, seriesId: "s", seriesOrder: 2 })).toEqual({ seriesId: "s", seriesOrder: 2 });
    const cur = { ...base, seriesId: "s", seriesOrder: 2 };
    expect(orgPatch(cur, { ...cur, seriesOrder: 5 })).toEqual({ seriesId: "s", seriesOrder: 5 });
    expect(orgPatch(cur, { ...cur, seriesId: null, seriesOrder: 5 })).toEqual({ seriesId: null, seriesOrder: null });
  });
  it("ধরন বদলালে শুধু contentType", () =>
    expect(orgPatch(base, { ...base, contentType: "poetry" })).toEqual({ contentType: "poetry" }));
});

describe("addTag", () => {
  const known = [{ id: "k1", name: "Travel" }];
  let n = 0;
  const mk = () => `new${++n}`;
  it("বিদ্যমান নামে মিললে (case-insens) সেই id, created=null", () => {
    const r = addTag([], " #travel ", known, mk, 60);
    expect(r).toEqual({ ok: true, tags: [{ id: "k1", name: "Travel" }], created: null });
  });
  it("নতুন নামে নতুন id ও created", () => {
    const r = addTag([], "সমুদ্র", known, mk, 60);
    expect(r.ok && r.created?.name).toBe("সমুদ্র");
    expect(r.ok && r.tags).toHaveLength(1);
  });
  it("ডুপ্লিকেট/খালি/লম্বা/সীমা আটকায়", () => {
    const t = [{ id: "k1", name: "Travel" }];
    expect(addTag(t, "travel", known, mk, 60)).toEqual({ ok: false, reason: "dup" });
    expect(addTag(t, "  # ", known, mk, 60)).toEqual({ ok: false, reason: "empty" });
    expect(addTag(t, "x".repeat(61), known, mk, 60)).toEqual({ ok: false, reason: "long" });
    const full = Array.from({ length: 20 }, (_, i) => ({ id: `i${i}`, name: `n${i}` }));
    expect(addTag(full, "নতুন", known, mk, 60)).toEqual({ ok: false, reason: "limit" });
  });
  it("একই নতুন নাম দুবার = dup (দুটো নতুন ট্যাগ নয়)", () => {
    const a = addTag([], "ভোর", [], mk, 60);
    expect(a.ok).toBe(true);
    expect(addTag(a.ok ? a.tags : [], "ভোর", [], mk, 60)).toEqual({ ok: false, reason: "dup" });
  });
});

describe("parseSeriesOrder", () => {
  it("খালি → null; সংখ্যা → সংখ্যা; ভুল → invalid", () => {
    expect(parseSeriesOrder("")).toBeNull();
    expect(parseSeriesOrder(" 7 ")).toBe(7);
    expect(parseSeriesOrder("-1")).toBe("invalid");
    expect(parseSeriesOrder("1.5")).toBe("invalid");
    expect(parseSeriesOrder("abc")).toBe("invalid");
  });
});
