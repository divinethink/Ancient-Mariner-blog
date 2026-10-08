import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PostWithId } from "./postRepo";
import { readSnapshot, writeSnapshot } from "./publicSnapshot";
import { DEFAULT_SETTINGS } from "./siteSettingsRepo";

const post = (id: string, over: Partial<PostWithId> = {}): PostWithId => ({
  id,
  title: "শিরোনাম",
  slug: `s-${id}`,
  slugHistory: ["old"],
  contentType: "post",
  body: "{}",
  excerpt: "",
  status: "published",
  visibility: "public",
  wordCount: 3,
  tagIds: [],
  tagNames: [],
  publishedAt: new Date("2026-10-01T00:00:00Z"),
  ownerUid: "uid",
  createdAt: new Date("2026-09-30T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  schemaVersion: 1,
  ...over,
});

describe("publicSnapshot — সংগঠন-ফিল্ড (P3a-৩)", () => {
  it("category/tag/series জোড়া লেখা-পড়ায় অক্ষত থাকে", async () => {
    const dir = await mkdtemp(join(tmpdir(), "snap-org-"));
    const path = join(dir, "posts.json");
    await writeSnapshot(
      [post("a", { categoryId: "c1", categoryName: "ভ্রমণ", tagIds: ["t1", "t2"], tagNames: ["সমুদ্র", "ছুটি"], seriesId: "s1", seriesOrder: 3 }), post("b")],
      new Date(),
      path,
    );
    const s = await readSnapshot(path);
    expect(s?.posts[0]).toMatchObject({
      categoryId: "c1",
      categoryName: "ভ্রমণ",
      tagIds: ["t1", "t2"],
      tagNames: ["সমুদ্র", "ছুটি"],
      seriesId: "s1",
      seriesOrder: 3,
    });
    // সংগঠনহীন পুরনো লেখা ভাঙে না
    expect(s?.posts[1].categoryId).toBeUndefined();
    expect(s?.posts[1].tagIds).toEqual([]);
  });
});

describe("publicSnapshot", () => {
  it("লেখা-পড়ায় Date ফেরে ও ক্রম থাকে", async () => {
    const dir = await mkdtemp(join(tmpdir(), "snap-"));
    const path = join(dir, "sub", "posts.json");
    const at = new Date("2026-10-05T10:00:00Z");
    await writeSnapshot([post("a"), post("b")], at, path);
    const s = await readSnapshot(path);
    expect(s?.fetchedAt.toISOString()).toBe(at.toISOString());
    expect(s?.posts.map((p) => p.id)).toEqual(["a", "b"]);
    expect(s?.posts[0].publishedAt).toBeInstanceOf(Date);
    expect(s?.posts[0].slugHistory).toEqual(["old"]);
  });
  it("ফাইল না থাকলে null", async () => {
    expect(await readSnapshot(join(tmpdir(), "no-such-dir", "x.json"))).toBeNull();
  });
  it("published+public নয় এমন লেখা বাদ; বিকৃত ফাইলে throw", async () => {
    const dir = await mkdtemp(join(tmpdir(), "snap-"));
    const path = join(dir, "posts.json");
    await writeSnapshot([post("a"), post("b", { visibility: "private" }), post("c", { status: "draft" })], new Date(), path);
    expect((await readSnapshot(path))?.posts.map((p) => p.id)).toEqual(["a"]);
    await writeFile(path, '{"posts":1}', "utf8");
    await expect(readSnapshot(path)).rejects.toThrow();
  });
  it("settings লেখা-পড়ায় থাকে", async () => {
    const dir = await mkdtemp(join(tmpdir(), "snap-"));
    const path = join(dir, "posts.json");
    const settings = { ...DEFAULT_SETTINGS, siteTitle: "আমার ব্লগ", allowIndexing: true };
    await writeSnapshot([post("a")], new Date(), path, settings);
    expect((await readSnapshot(path))?.settings).toEqual(settings);
  });
  it("পুরনো snapshot (settings ছাড়া) → defaults", async () => {
    const dir = await mkdtemp(join(tmpdir(), "snap-"));
    const path = join(dir, "old.json");
    await writeFile(path, JSON.stringify({ fetchedAt: new Date().toISOString(), posts: [] }), "utf8");
    expect((await readSnapshot(path))?.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe("publicSnapshot — terms (P4a-১)", () => {
  it("terms লেখা-পড়ায় অক্ষত; পুরনো snapshot (terms নেই) = খালি", async () => {
    const dir = await mkdtemp(join(tmpdir(), "snap-terms-"));
    const path = join(dir, "posts.json");
    const t = (id: string) => ({
      id, name: "ভ্রমণ", slug: `s-${id}`, description: "", ownerUid: "u",
      createdAt: new Date("2026-10-01T00:00:00Z"), updatedAt: new Date("2026-10-01T00:00:00Z"), schemaVersion: 1,
    });
    await writeSnapshot([post("a")], new Date(), path, DEFAULT_SETTINGS, { categories: [t("c1")], tags: [t("t1")], series: [] });
    const s = await readSnapshot(path);
    expect(s?.terms.categories[0]).toMatchObject({ id: "c1", slug: "s-c1" });
    expect(s?.terms.categories[0].createdAt).toBeInstanceOf(Date);
    expect(s?.terms.tags).toHaveLength(1);
    const old = join(dir, "old.json");
    await writeFile(old, JSON.stringify({ fetchedAt: new Date().toISOString(), posts: [] }), "utf8");
    expect((await readSnapshot(old))?.terms).toEqual({ categories: [], tags: [], series: [] });
  });
});

describe("publicSnapshot — pages (P4b-১)", () => {
  const pg = (slug: string, status: string) => ({
    slug, title: "এই আমি", body: "{}", status, system: false, ownerUid: "u",
    createdAt: new Date("2026-10-01T00:00:00Z"), updatedAt: new Date("2026-10-01T00:00:00Z"), schemaVersion: 1,
  });
  it("pages লেখা-পড়ায় অক্ষত; draft বাদ; পুরনো snapshot (pages নেই) = খালি", async () => {
    const dir = await mkdtemp(join(tmpdir(), "snap-pages-"));
    const path = join(dir, "posts.json");
    await writeSnapshot([post("a")], new Date(), path, DEFAULT_SETTINGS, undefined, [pg("about", "published"), pg("wip", "draft")] as never);
    const s = await readSnapshot(path);
    expect(s?.pages.map((p) => p.slug)).toEqual(["about"]);
    expect(s?.pages[0].createdAt).toBeInstanceOf(Date);
    const old = join(dir, "old.json");
    await writeFile(old, JSON.stringify({ fetchedAt: new Date().toISOString(), posts: [] }), "utf8");
    expect((await readSnapshot(old))?.pages).toEqual([]);
  });
});
