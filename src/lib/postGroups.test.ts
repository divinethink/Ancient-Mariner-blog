import { describe, expect, it } from "vitest";
import { byCategory, bySeries, byTag, type GroupPost } from "./postGroups";

const p = (id: string, o: Partial<GroupPost> = {}) => ({ id, tagIds: [] as string[], ...o });

describe("postGroups", () => {
  const posts = [
    p("a", { categoryId: "c1", tagIds: ["t1"] }),
    p("b", { categoryId: "c2", tagIds: ["t1", "t2"] }),
    p("c"),
    p("d", { categoryId: "c1" }),
  ];
  it("category: ক্রম অক্ষত; সন্তান-category সহ", () => {
    expect(byCategory(posts, "c1").map((x) => x.id)).toEqual(["a", "d"]);
    expect(byCategory(posts, "c1", ["c2"]).map((x) => x.id)).toEqual(["a", "b", "d"]);
    expect(byCategory(posts, "none")).toEqual([]);
  });
  it("tag: tagIds-এ থাকলেই", () => {
    expect(byTag(posts, "t1").map((x) => x.id)).toEqual(["a", "b"]);
    expect(byTag(posts, "t2").map((x) => x.id)).toEqual(["b"]);
  });
  it("series: seriesOrder asc; order-হীন শেষে; সমানে মূল ক্রম", () => {
    const s = [
      p("w", { seriesId: "s", seriesOrder: 3 }),
      p("x", { seriesId: "s" }),
      p("y", { seriesId: "s", seriesOrder: 1 }),
      p("z", { seriesId: "other", seriesOrder: 0 }),
      p("v", { seriesId: "s", seriesOrder: 3 }),
    ];
    expect(bySeries(s, "s").map((x) => x.id)).toEqual(["y", "w", "v", "x"]);
  });
});
