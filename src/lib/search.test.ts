import { describe, expect, it } from "vitest";
import {
  facets,
  fold,
  highlight,
  ideaEntry,
  isIndexablePost,
  matchRanges,
  maxUpdated,
  noteEntry,
  passesFilter,
  postEntry,
  prepare,
  search,
  syncCursor,
  SYNC_OVERLAP_MS,
  tokenize,
  toSegments,
  type SearchEntry,
} from "./search";

const doc = (...paras: string[]) =>
  JSON.stringify({
    type: "doc",
    content: paras.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })),
  });

const post = (
  id: string,
  title: string,
  paras: string[],
  extra: Partial<Parameters<typeof postEntry>[0]> = {},
) =>
  postEntry({
    id,
    title,
    excerpt: "",
    body: doc(...paras),
    contentType: "post",
    status: "draft",
    updatedAt: 1000,
    ...extra,
  });

describe("fold/tokenize", () => {
  it("NFC: ো (০9CB) এবং ে+া একই", () => {
    expect(fold("কো").f).toBe(fold("কো").f);
  });
  it("ZWJ/ZWNJ ও soft-hyphen উপেক্ষা: র‍্যাব = র্যাব", () => {
    expect(fold("র‍্যাব").f).toBe(fold("র্যাব").f);
    expect(fold("ক‌ক").f).toBe("কক");
    expect(fold("a­b").f).toBe("ab");
  });
  it("ড় (decomposed/precomposed) মেলে", () => {
    expect(fold("ড়").f).toBe(fold("ড়").f);
  });
  it("case-insensitive; ফাঁকা বাদ; অনন্য; সীমা", () => {
    expect(tokenize("  Hello   WORLD hello ")).toEqual(["hello", "world"]);
    expect(tokenize("")).toEqual([]);
    expect(tokenize("a b c d e f g h i j")).toHaveLength(8);
  });
});

describe("search", () => {
  const entries: SearchEntry[] = [
    post("1", "সমুদ্রযাত্রা", ["আজ সকালে আমরা জাহাজে উঠলাম।", "ঢেউয়ের শব্দ শুনলাম।"], {
      updatedAt: 10,
    }),
    post("2", "দিনলিপি", ["সমুদ্রের ধারে বসে চা খেলাম।"], { updatedAt: 20, contentType: "diary" }),
    post("3", "অন্য লেখা", ["কিছু নেই এখানে।"], {
      updatedAt: 30,
      status: "published",
      categoryId: "c1",
      categoryName: "গল্প",
    }),
    ideaEntry({ id: "i1", title: "সমুদ্র নিয়ে গল্প", text: "জাহাজডুবি", updatedAt: 40 }),
    noteEntry({ id: "n1", content: "সমুদ্র ও জাহাজ", updatedAt: 5 }),
  ];
  const prep = prepare(entries);

  it("শিরোনাম ও ভেতরের বাক্য — দুটোই মেলে", () => {
    const keys = search(prep, "সমুদ্র").hits.map((h) => h.entry.key);
    expect(keys).toContain("post:1"); // শিরোনামে
    expect(keys).toContain("post:2"); // শুধু লেখায়
    expect(keys).toContain("idea:i1");
    expect(keys).toContain("note:n1");
    expect(keys).not.toContain("post:3");
  });
  it("শিরোনামের মিল লেখার মিলের আগে", () => {
    const keys = search(prep, "সমুদ্র").hits.map((h) => h.entry.key);
    expect(keys.indexOf("post:1")).toBeLessThan(keys.indexOf("post:2"));
  });
  it("একাধিক শব্দ = AND (ভিন্ন ক্ষেত্রেও)", () => {
    expect(
      search(prep, "সমুদ্র জাহাজ")
        .hits.map((h) => h.entry.key)
        .sort(),
    ).toEqual(["idea:i1", "note:n1", "post:1"]); // জাহাজডুবি-তে 'জাহাজ' — অংশ-মিল
    expect(search(prep, "সমুদ্র কিছুই-নেই").total).toBe(0);
  });
  it("খালি query ⇒ খালি", () => {
    expect(search(prep, "   ")).toEqual({ hits: [], total: 0 });
  });
  it("ZWJ ছাড়া/সহ টাইপ — দুইভাবেই মেলে", () => {
    const e = [post("z", "র‍্যাব", ["র‍্যাব দল"])];
    expect(search(prepare(e), "র্যাব").total).toBe(1);
    expect(search(prepare([post("z2", "র্যাব", ["র্যাব"])]), "র‍্যাব").total).toBe(1);
  });
  it("limit ও total আলাদা", () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      post(`m${i}`, "শব্দ", ["শব্দ"], { updatedAt: i }),
    );
    const r = search(prepare(many), "শব্দ", {}, 2);
    expect(r.hits).toHaveLength(2);
    expect(r.total).toBe(5);
    expect(r.hits[0].entry.updatedAt).toBeGreaterThanOrEqual(r.hits[1].entry.updatedAt);
  });
  it("ফিল্টার: type/status/category", () => {
    expect(search(prep, "সমুদ্র", { type: "diary" }).hits.map((h) => h.entry.key)).toEqual([
      "post:2",
    ]);
    expect(search(prep, "সমুদ্র", { type: "idea" }).hits.map((h) => h.entry.key)).toEqual([
      "idea:i1",
    ]);
    expect(
      search(prep, "সমুদ্র", { status: "draft" }).hits.every((h) => h.entry.kind === "post"),
    ).toBe(true);
    expect(search(prep, "লেখা", { categoryId: "c1" }).hits.map((h) => h.entry.key)).toEqual([
      "post:3",
    ]);
    expect(passesFilter(entries[3], { status: "draft" })).toBe(false);
  });
});

describe("entry", () => {
  it("বিকৃত body ⇒ খালি লেখা, ভাঙে না", () => {
    const e = postEntry({
      id: "x",
      title: "শি",
      excerpt: "",
      body: "{not json",
      status: "draft",
      updatedAt: new Date(7),
    });
    expect(e.text).toBe("");
    expect(e.updatedAt).toBe(7);
  });
  it("trashed index-যোগ্য নয়", () => {
    expect(isIndexablePost("trashed")).toBe(false);
    expect(isIndexablePost("archived")).toBe(true);
  });
  it("দীর্ঘ লেখা সীমায় কাটে", () => {
    const e = ideaEntry({ id: "big", text: "ক".repeat(500_000), updatedAt: 1 });
    expect(e.text.length).toBe(400_000);
  });
});

describe("highlight", () => {
  it("শিরোনামের মিল চিহ্নিত", () => {
    const e = post("h", "সমুদ্রযাত্রা", ["x"]);
    const h = highlight(e, "যাত্রা");
    expect(h.title.filter((s) => s.hit).map((s) => s.text)).toEqual(["যাত্রা"]);
    expect(h.title.map((s) => s.text).join("")).toBe("সমুদ্রযাত্রা");
  });
  it("ZWJ-সহ মূল লেখায় মিল ঠিক অবস্থানে", () => {
    const src = "ক র‍্যাব খ";
    const r = matchRanges(src, tokenize("র্যাব"));
    expect(r).toHaveLength(1);
    expect(src.slice(r[0][0], r[0][1])).toBe("র‍্যাব");
  });
  it("snippet: দীর্ঘ লেখায় ... দিয়ে কাটে, মিল থাকে", () => {
    const long = `${"অ ".repeat(200)}মাছরাঙা ${"আ ".repeat(200)}`;
    const e = post("s", "শি", [long]);
    const h = highlight(e, "মাছরাঙা");
    const joined = h.snippet.map((s) => s.text).join("");
    expect(h.snippetFrom).toBe("text");
    expect(joined.startsWith("…")).toBe(true);
    expect(joined.endsWith("…")).toBe(true);
    expect(joined.length).toBeLessThan(200);
    expect(h.snippet.filter((s) => s.hit).map((s) => s.text)).toEqual(["মাছরাঙা"]);
  });
  it("লেখায় না থাকলে সারাংশ থেকে; কিছুই না মিললে শুরুর অংশ", () => {
    const e = postEntry({
      id: "e",
      title: "শি",
      excerpt: "সারাংশে নদী আছে",
      body: doc("অন্য"),
      status: "draft",
      updatedAt: 1,
    });
    expect(highlight(e, "নদী").snippetFrom).toBe("excerpt");
    expect(highlight(e, "নেই").snippetFrom).toBe("none");
  });
  it("toSegments ফাঁকা range ⇒ পুরোটা একটাই অংশ", () => {
    expect(toSegments("abc", [])).toEqual([{ text: "abc", hit: false }]);
  });
});

describe("sync/facets", () => {
  it("cursor: প্রথমবার null; পরে overlap বাদ", () => {
    expect(syncCursor(undefined)).toBeNull();
    expect(syncCursor(0)).toBeNull();
    expect(syncCursor(10_000_000)).toBe(10_000_000 - SYNC_OVERLAP_MS);
    expect(syncCursor(100)).toBe(0);
    expect(maxUpdated([{ updatedAt: 3 }, { updatedAt: 9 }], 5)).toBe(9);
  });
  it("facets: শুধু আছে এমন type ও category", () => {
    const es = [
      post("a", "শি", ["x"], { contentType: "diary" }),
      post("b", "শি", ["x"], { contentType: "story", categoryId: "c", categoryName: "খ" }),
      ideaEntry({ id: "i", text: "t", updatedAt: 1 }),
    ];
    const f = facets(es, ["post", "diary", "story", "poetry"]);
    expect(f.types).toEqual(["diary", "story"]);
    expect(f.categories).toEqual([{ id: "c", name: "খ" }]);
  });
});
