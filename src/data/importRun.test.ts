import { describe, expect, it, vi } from "vitest";
import type { ImportRow } from "@/data/importPosts.client";
import { runImport, type ImportDeps, type TermKind } from "@/data/importRun";
import { planImport, type WxrFile, type WxrItem } from "@/lib/import/plan";

const item = (o: Partial<WxrItem>): WxrItem => ({
  wpId: "1", type: "post", status: "draft", title: "লেখা", slug: "x", dateGmt: "2015-03-24 12:58:09",
  link: "u", content: "<p>বডি</p>", categories: [{ slug: "c", name: "সাহিত্য" }], tags: [{ slug: "t", name: "গল্প" }], ...o,
});
const plan = (items: WxrItem[]) =>
  planImport({ siteTitle: "ব্লগ", siteUrl: "", items } as WxrFile, { existingSlugs: new Set() });

function kit(over: Partial<ImportDeps> = {}) {
  const owners = new Map<string, string>();
  const written: ImportRow[] = [];
  const terms = { categories: [] as { id: string; name: string }[], tags: [] as { id: string; name: string }[] };
  const deps: ImportDeps = {
    owners: async () => new Map(owners),
    terms: async (k) => [...terms[k]],
    createTerm: vi.fn(async (k: TermKind, id: string, name: string) => {
      terms[k].push({ id, name });
      return { id };
    }),
    commit: vi.fn(async (rows: ImportRow[]) => {
      for (const r of rows) {
        written.push(r);
        owners.set(r.draft.slug, r.draft.id);
      }
    }),
    wait: async () => undefined,
    ...over,
  };
  return { deps, owners, written, terms };
}

describe("runImport", () => {
  it("নতুন লেখা লেখে; ক্যাটাগরি/ট্যাগ একবার তৈরি ও id জোড়া; progress", async () => {
    const k = kit();
    const prog: [number, number][] = [];
    const r = await runImport(k.deps, plan([item({ wpId: "1" }), item({ wpId: "2", title: "দুই" })]), "s", (d, t) => prog.push([d, t]));
    expect(r).toMatchObject({ imported: 2, failed: 0, already: 0, termsCreated: { categories: 1, tags: 1 } });
    expect(k.written).toHaveLength(2);
    expect(k.written[0].categoryId).toBe(k.terms.categories[0].id);
    expect(k.written[0].tagIds).toEqual([k.terms.tags[0].id]);
    expect(prog.at(-1)).toEqual([2, 2]);
  });

  it("আবার চালালে duplicate নয় (সব skip, কিছু লেখা/তৈরি হয় না)", async () => {
    const k = kit();
    const p = plan([item({ wpId: "1" }), item({ wpId: "2", title: "দুই" })]);
    await runImport(k.deps, p, "s");
    const again = await runImport(k.deps, p, "s");
    expect(again).toMatchObject({ imported: 0, already: 2, failed: 0 });
    expect(k.written).toHaveLength(2);
    expect(k.deps.createTerm).toHaveBeenCalledTimes(2);
  });

  it("বিদ্যমান ক্যাটাগরি/ট্যাগ নাম মিলিয়ে reuse (কাঠামো-নিরপেক্ষ)", async () => {
    const k = kit();
    k.terms.categories.push({ id: "cat1", name: " সাহিত্য " });
    k.terms.tags.push({ id: "tag1", name: "গল্প" });
    const r = await runImport(k.deps, plan([item({})]), "s");
    expect(r.termsCreated).toEqual({ categories: 0, tags: 0 });
    expect(k.written[0]).toMatchObject({ categoryId: "cat1", tagIds: ["tag1"] });
  });

  it("commit ব্যর্থ → retry; সফল-হয়েও-জবাব-হারানো লেখা দ্বিতীয়বার লেখা হয় না", async () => {
    let calls = 0;
    const k = kit();
    const real = k.deps.commit;
    k.deps.commit = vi.fn(async (rows: ImportRow[]) => {
      calls++;
      await real(rows);
      if (calls === 1) throw new Error("lost response");
    });
    const r = await runImport(k.deps, plan([item({})]), "s");
    expect(r).toMatchObject({ imported: 1, failed: 0 });
    expect(calls).toBe(1);
  });

  it("সব চেষ্টা ব্যর্থ → failed + শিরোনাম; পরের chunk চলে; পরে আবার চালালে শুধু ব্যর্থটা লেখা হয়", async () => {
    const k = kit();
    const real = k.deps.commit;
    let broken = true;
    k.deps.commit = vi.fn(async (rows: ImportRow[]) => {
      if (broken && rows.some((x) => x.draft.title === "খারাপ")) throw new Error("net");
      await real(rows);
    });
    const items = [item({ wpId: "1", title: "খারাপ" })];
    const r1 = await runImport(k.deps, plan(items), "s");
    expect(r1).toMatchObject({ imported: 0, failed: 1, failedTitles: ["খারাপ"] });
    broken = false;
    const r2 = await runImport(k.deps, plan(items), "s");
    expect(r2).toMatchObject({ imported: 1, failed: 0 });
  });

  it("term তৈরি ব্যর্থ → throw, কোনো লেখা লেখা হয়নি", async () => {
    const k = kit({ createTerm: async () => { throw new Error("rules"); } });
    await expect(runImport(k.deps, plan([item({})]), "s")).rejects.toThrow();
    expect(k.written).toHaveLength(0);
  });

  it("ক্যাটাগরি-ট্যাগহীন লেখা ঠিক; কিছু নতুন না থাকলে term-ছোঁয়া নেই", async () => {
    const k = kit();
    const r = await runImport(k.deps, plan([item({ categories: [], tags: [] })]), "s");
    expect(r.imported).toBe(1);
    expect(k.written[0].categoryId).toBeUndefined();
    expect(k.deps.createTerm).not.toHaveBeenCalled();
  });
});
