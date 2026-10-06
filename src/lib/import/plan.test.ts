import { describe, expect, it } from "vitest";
import { importSlug, parseWpDate, planImport, hostOf, type WxrFile, type WxrItem } from "./plan";

const item = (o: Partial<WxrItem>): WxrItem => ({
  wpId: "1", type: "post", status: "publish", title: "শিরোনাম", slug: "x", dateGmt: "2015-03-24 12:58:09",
  link: "https://old.example/1", content: "<p>লেখা এখানে</p>", categories: [], tags: [], ...o,
});
const file = (items: WxrItem[]): WxrFile => ({ siteTitle: "ব্লগ", siteUrl: "https://old.example", items });
const none = new Set<string>();

describe("importSlug", () => {
  it("শিরোনাম থেকে; WordPress-এর কাটা post_name নয়", () => {
    expect(importSlug("%e0%a6%95%e0%a6%bf-cut__trashed", "কিছু সাইট", "1")).toBe("কিছু-সাইট");
  });
  it("শিরোনাম slug-অযোগ্য হলে মূল নাম (decode + __trashed বাদ), তাও না হলে wpId", () => {
    expect(importSlug("%e0%a6%95%e0%a6%bf__trashed", "???", "5")).toBe("কি");
    expect(importSlug("", "???", "5")).toMatch(/^post-wp5/);
  });
});
describe("parseWpDate/hostOf", () => {
  it("UTC; শূন্য তারিখ → null", () => {
    expect(parseWpDate("2015-03-24 12:58:09")?.toISOString()).toBe("2015-03-24T12:58:09.000Z");
    expect(parseWpDate("0000-00-00 00:00:00")).toBeNull();
    expect(hostOf("https://A.com/x.jpg")).toBe("a.com");
    expect(hostOf("/rel.jpg")).toBe("(অন্যান্য)");
  });
});
describe("planImport", () => {
  it("সংখ্যা: publish/draft/private, trash বাদ, অন্য type আলাদা, page-শিরোনাম", () => {
    const p = planImport(
      file([
        item({ wpId: "1", title: "ক" }),
        item({ wpId: "2", title: "খ", status: "draft" }),
        item({ wpId: "3", title: "গ", status: "private" }),
        item({ wpId: "4", title: "ঘ", status: "trash" }),
        item({ wpId: "5", type: "page", title: "এই আমি" }),
        item({ wpId: "6", type: "attachment", status: "inherit" }),
        item({ wpId: "7", type: "custom_x", status: "publish" }),
      ]),
      { existingSlugs: none },
    );
    expect(p.summary.bySource).toEqual({ publish: 1, draft: 1, private: 1, other: 0 });
    expect(p.summary.totalPosts).toBe(3);
    expect(p.summary.skipped.trash).toBe(1);
    expect(p.summary.skipped.otherTypes).toEqual({ custom_x: 1 });
    expect(p.summary.pages).toEqual(["এই আমি"]);
  });
  it("slug-সংঘাত: ফাইলের ভেতরে ও বিদ্যমান slug-এর সাথে", () => {
    const p = planImport(file([item({ wpId: "1", title: "একই" }), item({ wpId: "2", title: "একই" }), item({ wpId: "3", title: "আছে" })]), {
      existingSlugs: new Set(["আছে"]),
    });
    expect(p.summary.conflicts).toEqual([
      { slug: "একই", title: "একই", with: "file" },
      { slug: "আছে", title: "আছে", with: "existing" },
    ]);
  });
  it("ক্যাটাগরি/ট্যাগ গণনা, ছবি-host, বাদ-পড়া element, ফ্ল্যাগ", () => {
    const p = planImport(
      file([
        item({
          wpId: "1",
          slug: "a__trashed",
          dateGmt: "0000-00-00 00:00:00",
          content: '<p>আ</p><img src="https://h.com/1.jpg"><iframe src="x"></iframe>',
          categories: [{ slug: "k", name: "কবিতা" }],
          tags: [{ slug: "t", name: "টি" }],
        }),
        item({ wpId: "2", title: "দুই", content: "", categories: [{ slug: "k", name: "কবিতা" }] }),
      ]),
      { existingSlugs: none },
    );
    expect(p.summary.categories).toEqual([{ name: "কবিতা", count: 2 }]);
    expect(p.summary.tagCount).toBe(1);
    expect(p.summary.images).toEqual({ total: 1, byHost: [{ host: "h.com", count: 1 }] });
    expect(p.summary.dropped).toEqual({ img: 1, iframe: 1 });
    expect(p.summary.trashResidue).toBe(1);
    expect(p.summary.noDate).toBe(1);
    expect(p.summary.empty).toBe(1);
    expect(p.posts[0].originalDate).toBeNull();
  });
  it("body JSON-string, wordCount ও excerpt হয়; কিছু বদলায় না (pure)", () => {
    const f = file([item({ content: "<p>এক দুই তিন</p>" })]);
    const p = planImport(f, { existingSlugs: none });
    expect(JSON.parse(p.posts[0].body).type).toBe("doc");
    expect(p.posts[0].wordCount).toBe(3);
    expect(p.posts[0].excerpt).toBe("এক দুই তিন");
    expect(f.items[0].content).toBe("<p>এক দুই তিন</p>");
  });
});
