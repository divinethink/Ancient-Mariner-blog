import { describe, expect, it } from "vitest";
import { DEFAULT_HOME, DEFAULT_SIDEBAR, resolveLayout } from "./layout";
import { pickFeatured } from "./featured";

describe("resolveLayout", () => {
  it("খালি সংরক্ষণ = default", () => {
    expect(resolveLayout([], DEFAULT_SIDEBAR)).toEqual(DEFAULT_SIDEBAR);
  });
  it("সংরক্ষিত ক্রম/অবস্থা মানে; অজানা ও ডুপ্লিকেট id বাদ; বাদ-পড়া default শেষে নিজের অবস্থায়", () => {
    const r = resolveLayout(
      [
        { id: "recent", enabled: true },
        { id: "nope", enabled: true },
        { id: "recent", enabled: false },
        { id: "facebook", enabled: false },
      ],
      DEFAULT_SIDEBAR,
    );
    expect(r.map((x) => x.id)).toEqual(["recent", "facebook", "category", "links", "follow", "author"]);
    expect(r[0]).toEqual({ id: "recent", enabled: true });
    expect(r[1]).toEqual({ id: "facebook", enabled: false });
    expect(r.find((x) => x.id === "author")?.enabled).toBe(false);
  });
  it("Home default: hero, featured, recent সব চালু", () => {
    expect(resolveLayout([], DEFAULT_HOME).map((x) => `${x.id}:${x.enabled}`)).toEqual(["hero:true", "featured:true", "recent:true"]);
  });
});

describe("pickFeatured", () => {
  const d = (s: string) => new Date(s);
  it("featured থাকলে তার মধ্যে সর্বশেষ", () => {
    const ps = [
      { id: "a", publishedAt: d("2026-10-05") },
      { id: "b", featured: true, publishedAt: d("2026-09-01") },
      { id: "c", featured: true, publishedAt: d("2026-09-10") },
    ];
    expect(pickFeatured(ps)).toBe("c");
  });
  it("featured না থাকলে (বা false) সর্বশেষ published; তালিকা খালি হলে undefined", () => {
    expect(pickFeatured([{ id: "a", featured: false, publishedAt: d("2026-09-01") }, { id: "b", publishedAt: d("2026-10-01") }])).toBe("b");
    expect(pickFeatured([])).toBeUndefined();
  });
  it("সমান সময়ে ইনপুটের প্রথমটা", () => {
    const t = d("2026-10-01");
    expect(pickFeatured([{ id: "x", publishedAt: t }, { id: "y", publishedAt: t }])).toBe("x");
  });
});
