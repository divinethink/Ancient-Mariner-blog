import { describe, expect, it } from "vitest";
import { chunkWrites, importPostId, importTermId, normName, planWrites, termName, wantedTerms, CHUNK_MAX_POSTS } from "./commit";
import { planImport, type WxrFile, type WxrItem } from "./plan";

const item = (o: Partial<WxrItem>): WxrItem => ({
  wpId: "1", type: "post", status: "publish", title: "শিরোনাম", slug: "x", dateGmt: "2015-03-24 12:58:09",
  link: "https://old.example/1", content: "<p>লেখা এখানে</p>", categories: [], tags: [], ...o,
});
const file = (items: WxrItem[]): WxrFile => ({ siteTitle: "ব্লগ", siteUrl: "https://old.example", items });
const plan = (items: WxrItem[]) => planImport(file(items), { existingSlugs: new Set() });
const none = new Map<string, string>();

describe("importPostId / importTermId", () => {
  it("নির্ধারিত, ^[A-Za-z0-9]{1,40}$, সোর্স ও wpId অনুযায়ী আলাদা; নাম-কাঠামো-নিরপেক্ষ", () => {
    const a = importPostId("ব্লগ-১", "12")!;
    expect(a).toMatch(/^[A-Za-z0-9]{1,40}$/);
    expect(importPostId(" ব্লগ-১ ", "12")).toBe(a);
    expect(importPostId("ব্লগ-২", "12")).not.toBe(a);
    expect(importPostId("ব্লগ-১", "13")).not.toBe(a);
    expect(importPostId("x", "")).toBeNull();
    expect(importTermId("tags", "  Foo  Bar")).toBe(importTermId("tags", "foo bar"));
    expect(importTermId("tags", "a")).not.toBe(importTermId("categories", "a"));
  });
});

describe("planWrites", () => {
  it("সব লেখা নতুন → writes; slug-সংঘাত (ফাইলের ভেতরে + বিদ্যমান) -২/-৩", () => {
    const p = plan([
      item({ wpId: "1", title: "একই" }),
      item({ wpId: "2", title: "একই" }),
      item({ wpId: "3", title: "একই" }),
      item({ wpId: "4", title: "অন্য" }),
    ]);
    const w = planWrites(p, "s", new Map([["অন্য", "other"]]));
    expect(w.writes.map((x) => x.slug)).toEqual(["একই", "একই-২", "একই-৩", "অন্য-২"]);
    expect(w.already).toBe(0);
  });
  it("আবার চালালে (lock-এর postId মিললে) skip; একই plan দুবার = শূন্য নতুন", () => {
    const p = plan([item({ wpId: "1" }), item({ wpId: "2", title: "দুই" })]);
    const first = planWrites(p, "s", none);
    const owners = new Map(first.writes.map((d) => [d.slug, d.id]));
    const again = planWrites(p, "s", owners);
    expect(again.writes).toHaveLength(0);
    expect(again.already).toBe(2);
  });
  it("অন্য সোর্স-নামে একই wpId আলাদা লেখা", () => {
    const p = plan([item({ wpId: "1" })]);
    const a = planWrites(p, "blog-1", none);
    const owners = new Map(a.writes.map((d) => [d.slug, d.id]));
    const b = planWrites(p, "blog-2", owners);
    expect(b.writes).toHaveLength(1);
    expect(b.writes[0].slug).toBe("শিরোনাম-২");
  });
  it("আংশিক ব্যর্থতার পর: যেগুলো লেখা হয়েছে শুধু সেগুলো skip, বাকি আগের slug-ই পায়", () => {
    const p = plan([item({ wpId: "1", title: "ক" }), item({ wpId: "2", title: "ক" })]);
    const full = planWrites(p, "s", none).writes;
    expect(full.map((d) => d.slug)).toEqual(["ক", "ক-২"]);
    const rerun = planWrites(p, "s", new Map([["ক", full[0].id]]));
    expect(rerun.writes.map((d) => d.slug)).toEqual(["ক-২"]);
  });
  it("৯০০KB-ছাড়ানো ও wpId-হীন বাদ; সোর্স-অবস্থা যা-ই হোক লেখা তৈরি", () => {
    const big = "<p>" + "ক".repeat(310_000) + "</p>";
    const p = plan([item({ wpId: "1", title: "বড়", content: big }), item({ wpId: "", title: "id-হীন" }), item({ wpId: "3", status: "private" })]);
    const w = planWrites(p, "s", none);
    expect(w.oversize).toEqual(["বড়"]);
    expect(w.invalid).toBe(1);
    expect(w.writes).toHaveLength(1);
  });
  it("ক্যাটাগরি: প্রথমটা পোস্টে, সব importSource-এ; ট্যাগ dedupe + ≤২০ (সব importSource-এ); মূল তারিখ/লিংক", () => {
    const tags = Array.from({ length: 25 }, (_, i) => ({ slug: `t${i}`, name: `ট্যাগ${i}` }));
    const p = plan([
      item({
        categories: [{ slug: "a", name: "প্রথম" }, { slug: "b", name: "দ্বিতীয়" }],
        tags: [...tags, { slug: "dup", name: " ট্যাগ0 " }],
      }),
    ]);
    const d = planWrites(p, " সোর্স ", none).writes[0];
    expect(d.categoryName).toBe("প্রথম");
    expect(d.tagNames).toHaveLength(20);
    expect(d.importSource.tags).toHaveLength(25);
    expect(d.importSource.categories).toEqual(["প্রথম", "দ্বিতীয়"]);
    expect(d.importSource.site).toBe("সোর্স");
    expect(d.importSource.originalDate?.toISOString()).toBe("2015-03-24T12:58:09.000Z");
    expect(d.importSource.originalUrl).toBe("https://old.example/1");
  });
});

describe("chunkWrites / wantedTerms / নাম", () => {
  it("≤১০০ লেখা ও বাইট-বাজেট; বড় একক লেখা একাই; ক্রম অক্ষত", () => {
    const mk = (n: number, bytes = 10) =>
      Array.from({ length: n }, (_, i) => ({ id: `i${i}`, bodyBytes: bytes }) as never);
    const c = chunkWrites(mk(CHUNK_MAX_POSTS + 1));
    expect(c.map((x) => x.length)).toEqual([CHUNK_MAX_POSTS, 1]);
    const big = chunkWrites(mk(5, 2 * 1024 * 1024));
    expect(big.map((x) => x.length)).toEqual([2, 2, 1]);
    expect(chunkWrites([])).toEqual([]);
  });
  it("wantedTerms ইউনিক; termName ≤৬০ অক্ষর ও ফাঁকা গোছানো", () => {
    const p = plan([
      item({ wpId: "1", categories: [{ slug: "a", name: "ক" }], tags: [{ slug: "t", name: "x" }] }),
      item({ wpId: "2", categories: [{ slug: "a", name: "ক" }], tags: [{ slug: "t", name: "X" }] }),
    ]);
    const w = wantedTerms(planWrites(p, "s", none).writes);
    expect(w).toEqual({ categories: ["ক"], tags: ["x"] });
    expect(Array.from(termName("ক".repeat(80)))).toHaveLength(60);
    expect(normName("  A  B ")).toBe("a b");
  });
});
