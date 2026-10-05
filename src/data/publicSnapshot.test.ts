import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PostWithId } from "./postRepo";
import { readSnapshot, writeSnapshot } from "./publicSnapshot";

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
  publishedAt: new Date("2026-10-01T00:00:00Z"),
  ownerUid: "uid",
  createdAt: new Date("2026-09-30T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  schemaVersion: 1,
  ...over,
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
});
