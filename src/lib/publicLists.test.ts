import { describe, expect, it } from "vitest";
import { buildScopes, type ListPost, type ScopeTerm } from "./publicLists";

const term = (id: string, name: string, o: Partial<ScopeTerm> = {}): ScopeTerm => ({ id, name, slug: `s-${id}`, description: "", ...o });
const post = (id: string, o: Partial<ListPost> = {}): ListPost => ({
  id, title: id, slug: id, excerpt: "x", body: "{}", wordCount: 10, tagIds: [], tagNames: [],
  publishedAt: new Date("2026-10-01T00:00:00Z"), ...o,
});

describe("buildScopes", () => {
  const terms = {
    categories: [term("c1", "ভ্রমণ"), term("c2", "সমুদ্র", { parentCategoryId: "c1" }), term("c3", "খালি")],
    tags: [term("t1", "ছুটি"), term("t2", "অব্যবহৃত")],
    series: [term("s1", "ধারা")],
  };
  const posts = [
    post("a", { categoryId: "c2", categoryName: "সমুদ্র", tagIds: ["t1"], tagNames: ["ছুটি"], seriesId: "s1", seriesOrder: 2 }),
    post("b", { categoryId: "c1", categoryName: "ভ্রমণ", seriesId: "s1", seriesOrder: 1 }),
    post("c"),
  ];
  const scopes = buildScopes({ posts, terms, timeZone: "Asia/Dhaka" });
  const get = (key: string) => scopes.find((s) => s.key === key);

  it("blog সবসময়; লেখা-হীন term-এর scope নেই", () => {
    expect(get("blog")?.cards.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(get("c-c3")).toBeUndefined();
    expect(get("t-t2")).toBeUndefined();
  });
  it("শীর্ষ category-তে সন্তানের লেখাও; সন্তানে parent (breadcrumb)", () => {
    expect(get("c-c1")?.cards.map((c) => c.id)).toEqual(["a", "b"]);
    expect(get("c-c2")?.cards.map((c) => c.id)).toEqual(["a"]);
    expect(get("c-c2")?.parent?.id).toBe("c1");
    expect(get("c-c1")?.parent).toBeUndefined();
  });
  it("tag ও series (seriesOrder asc); পথ percent-encoded", () => {
    expect(get("t-t1")?.cards.map((c) => c.id)).toEqual(["a"]);
    expect(get("s-s1")?.cards.map((c) => c.id)).toEqual(["b", "a"]);
    expect(get("c-c1")?.path).toBe("/category/s-c1");
  });
});
