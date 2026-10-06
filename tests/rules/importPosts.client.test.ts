// WordPress ইমপোর্ট (P3c-খ) আসল rules-এর নিচে Emulator-এ: Draft+Private, importSource, idempotent পুনরায় চালানো
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readSlugOwners } from "../../src/data/importKeys.client";
import { commitImportRows } from "../../src/data/importPosts.client";
import { runImport } from "../../src/data/importRun";
import { parsePost } from "../../src/data/postRepo";
import { createTaxonomyRepoClient } from "../../src/data/taxonomyRepo.client";
import { planImport, type WxrItem } from "../../src/lib/import/plan";
import { renderRules } from "../../src/lib/renderRules";

const OWNER = "testOwnerUid1234567890";
let env: RulesTestEnvironment;
const fs = (x: unknown) => x as Firestore;
const db = () => fs(env.authenticatedContext(OWNER).firestore());

const item = (o: Partial<WxrItem>): WxrItem => ({
  wpId: "1", type: "post", status: "publish", title: "লেখা", slug: "x", dateGmt: "2015-03-24 12:58:09",
  link: "https://old.example/1", content: "<p>বডি</p>", categories: [{ slug: "c", name: "সাহিত্য" }], tags: [{ slug: "t", name: "গল্প" }], ...o,
});
const plan = (items: WxrItem[]) =>
  planImport({ siteTitle: "ব্লগ", siteUrl: "", items }, { existingSlugs: new Set() });

function deps() {
  const d = db();
  const tax = (k: "categories" | "tags") => createTaxonomyRepoClient(d, OWNER, k);
  return {
    owners: () => readSlugOwners(d),
    terms: async (k: "categories" | "tags") => (await tax(k).list()).map((t) => ({ id: t.id, name: t.name })),
    createTerm: async (k: "categories" | "tags", id: string, name: string) => tax(k).create({ id, name }),
    commit: (rows: Parameters<typeof commitImportRows>[2]) => commitImportRows(d, OWNER, rows),
    wait: async () => undefined,
  };
}

beforeAll(async () => {
  const rules = renderRules(readFileSync("firestore.rules.tpl", "utf8"), OWNER);
  env = await initializeTestEnvironment({ projectId: "demo-ancientmarinerblog", firestore: { rules } });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

describe("WordPress ইমপোর্ট", () => {
  it("সোর্স-অবস্থা যা-ই হোক Draft + Private; importSource ও ক্যাটাগরি/ট্যাগ; slug-lock পোস্টের সাথে", async () => {
    const p = plan([item({ wpId: "7", status: "publish" }), item({ wpId: "8", title: "দুই", status: "private" })]);
    const r = await runImport(deps(), p, "ব্লগ-১");
    expect(r).toMatchObject({ imported: 2, failed: 0 });
    const posts = (await getDocs(collection(db(), "posts"))).docs.map((d) => parsePost(d.id, d.data()));
    expect(posts).toHaveLength(2);
    for (const x of posts) {
      expect(x).toMatchObject({ status: "draft", visibility: "private", categoryName: "সাহিত্য", tagNames: ["গল্প"] });
      expect(x.categoryId).toBeTruthy();
      expect(x.importSource?.site).toBe("ব্লগ-১");
      expect(x.importSource?.originalDate?.toISOString()).toBe("2015-03-24T12:58:09.000Z");
      expect((await getDoc(doc(db(), "slugs", x.slug))).data()?.postId).toBe(x.id);
    }
    expect(new Set(posts.map((x) => x.importSource?.wpPostId))).toEqual(new Set(["7", "8"]));
    expect((await getDocs(collection(db(), "categories"))).size).toBe(1);
    expect((await getDocs(collection(db(), "tags"))).size).toBe(1);
  });

  it("আবার চালালে duplicate নয়; ক্যাটাগরি/ট্যাগও বাড়ে না", async () => {
    const p = plan([item({ wpId: "1" }), item({ wpId: "2", title: "দুই" })]);
    await runImport(deps(), p, "ব্লগ-১");
    const again = await runImport(deps(), p, "ব্লগ-১");
    expect(again).toMatchObject({ imported: 0, already: 2, failed: 0 });
    expect((await getDocs(collection(db(), "posts"))).size).toBe(2);
    expect((await getDocs(collection(db(), "slugs"))).size).toBe(2);
    expect((await getDocs(collection(db(), "categories"))).size).toBe(1);
  });

  it("দুই ব্লগ আলাদা run: একই wpId/slug দুটোই থাকে (দ্বিতীয়টা -২)", async () => {
    const p = plan([item({ wpId: "1" })]);
    await runImport(deps(), p, "ব্লগ-১");
    const r = await runImport(deps(), p, "ব্লগ-২");
    expect(r.imported).toBe(1);
    const slugs = (await getDocs(collection(db(), "slugs"))).docs.map((d) => d.id).sort();
    expect(slugs).toEqual(["লেখা", "লেখা-২"]);
  });

  it("একই batch দ্বিতীয়বার সরাসরি লিখলে ব্যর্থ — আগের লেখা অক্ষত", async () => {
    const p = plan([item({ wpId: "1" })]);
    const d = deps();
    await runImport(d, p, "ব্লগ-১");
    const before = (await getDocs(collection(db(), "posts"))).docs[0];
    const slug = before.data().slug as string;
    await expect(
      commitImportRows(db(), OWNER, [
        {
          draft: {
            id: "x", title: "নতুন", slug, body: before.data().body, excerpt: "", wordCount: 0, bodyBytes: 1,
            tagNames: [], importSource: { site: "ব্লগ-১", wpPostId: "1", categories: [], tags: [] },
          },
          tagIds: [],
        },
      ]),
    ).rejects.toThrow();
    expect((await getDoc(doc(db(), "posts", before.id))).data()?.title).toBe("লেখা");
    expect((await getDocs(collection(db(), "posts"))).size).toBe(1);
  });
});
