import { describe, expect, it } from "vitest";
import { adjacentIds, relatedIds } from "./related";

const posts = [
  { id: "a", categoryId: "c1" },
  { id: "b", categoryId: "c2" },
  { id: "c", categoryId: "c1" },
  { id: "d", categoryId: "c1" },
  { id: "e", categoryId: "c1" },
  { id: "f" },
];
describe("relatedIds", () => {
  it("একই category, নিজে বাদ, নতুন আগে, সর্বোচ্চ ৩", () => {
    expect(relatedIds(posts, "a")).toEqual(["c", "d", "e"]);
    expect(relatedIds(posts, "e")).toEqual(["a", "c", "d"]);
  });
  it("category না থাকলে বা লেখা না পেলে খালি; ফল কম হলে যা আছে", () => {
    expect(relatedIds(posts, "f")).toEqual([]);
    expect(relatedIds(posts, "zz")).toEqual([]);
    expect(relatedIds(posts, "b")).toEqual([]);
  });
});
describe("adjacentIds", () => {
  it("older = পরের index, newer = আগের index; প্রান্তে একদিক নেই", () => {
    expect(adjacentIds(posts, "c")).toEqual({ older: "d", newer: "b" });
    expect(adjacentIds(posts, "a")).toEqual({ older: "b" });
    expect(adjacentIds(posts, "f")).toEqual({ newer: "e" });
    expect(adjacentIds(posts, "zz")).toEqual({});
  });
});
