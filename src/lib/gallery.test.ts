import { describe, expect, it } from "vitest";
import { mediaIdsOf, moveId, resolveGallery, resolveMediaMap, sameIds, toggleId } from "./gallery";

const m = (id: string) => ({ cloudinaryPublicId: `blog/${id}`, cloudinaryUrl: `https://res.cloudinary.com/demo/image/upload/v1/blog/${id}.jpg`, width: 800, height: 600, altText: id });

describe("resolveMediaMap", () => {
  it("মেটা থাকা id-ই map-এ; না-থাকা/অবৈধ-host বাদ", () => {
    const media = new Map([["a", m("a")], ["bad", { ...m("bad"), cloudinaryUrl: "https://evil.example/x.jpg" }]]);
    const out = resolveMediaMap(["a", "x", "bad"], media);
    expect([...out.keys()]).toEqual(["a"]);
    expect(out.get("a")?.cloud).toBe("demo");
    expect(resolveMediaMap(["a"], undefined).size).toBe(0);
  });
});

describe("gallery", () => {
  it("mediaIdsOf: cover+gallery, ডুপ্লিকেট ছাড়া", () => {
    expect(mediaIdsOf([{ coverMediaId: "a", gallery: ["b", "a", "c"] }, { gallery: ["c", "d"] }, {}])).toEqual(["a", "b", "c", "d"]);
  });
  it("resolveGallery: ক্রম বজায়, মেটা-না-থাকা বাদ, সীমা ২০", () => {
    const media = new Map([["a", m("a")], ["b", m("b")]]);
    expect(resolveGallery(["b", "x", "a"], media).map((v) => v.alt)).toEqual(["b", "a"]);
    expect(resolveGallery(undefined, media)).toEqual([]);
    const big = new Map(Array.from({ length: 25 }, (_, i) => [`i${i}`, m(`i${i}`)] as const));
    expect(resolveGallery([...big.keys()], big)).toHaveLength(20);
  });
  it("toggleId/moveId/sameIds", () => {
    expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
    expect(toggleId(["a", "b"], "c", 2)).toEqual(["a", "b"]);
    expect(moveId(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(sameIds(["a"], ["a"])).toBe(true);
    expect(sameIds(["a", "b"], ["b", "a"])).toBe(false);
  });
});
