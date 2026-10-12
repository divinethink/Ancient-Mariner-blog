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
    expect(relatedIds(posts, "a")).toEqual(["c", "d"]);
    expect(relatedIds(posts, "e")).toEqual(["a", "c"]);
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

import { seriesPosition } from "./related";
describe("seriesPosition", () => {
  const s = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("মাঝে/প্রান্তে আগের-পরের পর্ব", () => {
    expect(seriesPosition(s, "b")).toEqual({ index: 1, total: 3, prev: { id: "a" }, next: { id: "c" } });
    expect(seriesPosition(s, "a")).toEqual({ index: 0, total: 3, next: { id: "b" } });
    expect(seriesPosition(s, "c")).toEqual({ index: 2, total: 3, prev: { id: "b" } });
  });
  it("না পেলে null", () => expect(seriesPosition(s, "z")).toBeNull());
});
