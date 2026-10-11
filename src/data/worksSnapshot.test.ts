import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readWorks, writeWorks } from "./worksSnapshot";
import { parseChapter, parseProject } from "./projectRepo";

const t = new Date("2026-10-01T00:00:00Z");
const P = (id: string, o: Record<string, unknown> = {}) =>
  parseProject(id, { title: "প", slug: id, type: "novel", status: "published", visibility: "public", ownerUid: "u", createdAt: t, updatedAt: t, ...o });
const C = (id: string, o: Record<string, unknown> = {}) =>
  parseChapter(id, { projectId: "a", title: "অ", slug: id, body: "{}", order: 0, status: "published", visibility: "public", ownerUid: "u", createdAt: t, updatedAt: t, ...o });

describe("worksSnapshot", () => {
  it("লেখা → পড়া round-trip (তারিখ Date হয়ে ফেরে)", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "works-")), "w.json");
    await writeWorks([P("a")], [C("c1")], path);
    const w = await readWorks(path);
    expect(w).toHaveLength(1);
    expect(w[0].chapters[0].updatedAt).toBeInstanceOf(Date);
  });
  it("ফাইল না থাকলে/বিকৃত হলে খালি; ফাইলে draft থাকলেও বাদ", async () => {
    const dir = await mkdtemp(join(tmpdir(), "works-"));
    expect(await readWorks(join(dir, "nope.json"))).toEqual([]);
    await writeFile(join(dir, "bad.json"), "{oops", "utf8");
    expect(await readWorks(join(dir, "bad.json"))).toEqual([]);
    const path = join(dir, "d.json");
    await writeWorks([P("a"), P("b", { status: "draft" })], [C("c1"), C("c2", { status: "draft" })], path);
    const w = await readWorks(path);
    expect(w.map((x) => x.project.id)).toEqual(["a"]);
    expect(w[0].chapters.map((c) => c.id)).toEqual(["c1"]);
  });
});
