import { describe, expect, it } from "vitest";
import { checkParent, termSlugBase } from "./taxonomy";

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
