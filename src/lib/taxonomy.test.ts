import { describe, expect, it } from "vitest";
import { buildCategoryTree, checkParent, chunk, parentChoices, renamedTagNames, termSlugBase } from "./taxonomy";

describe("termSlugBase", () => {
  it("বাংলা নাম Unicode-preserving", () => expect(termSlugBase("ভ্রমণ কাহিনি", "abc")).toBe("ভ্রমণ-কাহিনি"));
  it("শুধু চিহ্ন হলে id-ভিত্তিক fallback", () => expect(termSlugBase("!!!", "AbCdEfGhIj")).toBe("term-abcdefgh"));
});

describe("checkParent", () => {
  it("বৈধ শীর্ষ-স্তর parent", () => expect(checkParent("c", { id: "p" }, false)).toEqual({ ok: true }));
  it("parent নেই → ব্যর্থ", () => expect(checkParent("c", null, false).ok).toBe(false));
  it("নিজে নিজের parent → ব্যর্থ", () => expect(checkParent("c", { id: "c" }, false).ok).toBe(false));
  it("parent নিজেই সন্তান → ব্যর্থ (৩ স্তর)", () =>
    expect(checkParent("c", { id: "p", parentCategoryId: "g" }, false).ok).toBe(false));
  it("সন্তান থাকা category সন্তান হতে পারে না", () => expect(checkParent("c", { id: "p" }, true).ok).toBe(false));
});

describe("chunk", () => {
  it("ভাগ করে; খালি → খালি", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});

describe("renamedTagNames", () => {
  it("নির্দিষ্ট সূচকের নাম বদলায়, বাকি অক্ষত", () =>
    expect(renamedTagNames(["a", "b"], ["x", "y"], "b", "z")).toEqual(["x", "z"]));
  it("নাম আগেই মিললে বা tag না থাকলে null (idempotent)", () => {
    expect(renamedTagNames(["a"], ["z"], "a", "z")).toBeNull();
    expect(renamedTagNames(["a"], ["z"], "q", "z")).toBeNull();
  });
  it("tagNames ছোট হলে খালি দিয়ে ভরে", () => expect(renamedTagNames(["a", "b"], ["x"], "b", "z")).toEqual(["x", "z"]));
});

describe("buildCategoryTree", () => {
  const t = (id: string, name: string, parentCategoryId?: string) => ({ id, name, parentCategoryId });
  it("সন্তান parent-এর ঠিক নিচে, depth সহ", () => {
    const rows = buildCategoryTree([t("k", "কক্সবাজার", "p"), t("d", "ডায়েরি"), t("p", "ভ্রমণ")]);
    expect(rows.map((r) => [r.term.id, r.depth])).toEqual([
      ["d", 0],
      ["p", 0],
      ["k", 1],
    ]);
  });
  it("parent অনুপস্থিত হলে সন্তান শীর্ষে — কিছু বাদ পড়ে না", () => {
    const rows = buildCategoryTree([t("k", "কক্সবাজার", "gone"), t("p", "ভ্রমণ")]);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.depth === 0)).toBe(true);
  });
  it("খালি → খালি", () => expect(buildCategoryTree([])).toEqual([]));
});

describe("parentChoices", () => {
  const t = (id: string, parentCategoryId?: string) => ({ id, parentCategoryId });
  const all = [t("a"), t("b"), t("c", "a")];
  it("নতুন: শুধু শীর্ষ-স্তর", () => expect(parentChoices(all, null).map((x) => x.id)).toEqual(["a", "b"]));
  it("নিজে বাদ", () => expect(parentChoices(all, "b").map((x) => x.id)).toEqual(["a"]));
  it("সন্তান থাকলে কোনো parent নয়", () => expect(parentChoices(all, "a")).toEqual([]));
});
