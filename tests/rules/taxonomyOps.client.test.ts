// taxonomyOps.client (rename-propagation, delete-guard, default ক্যাটাগরি, migration 001) — আসল rules-এর নিচে Emulator-এ
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPostRepoClient } from "../../src/data/postRepo.client";
import { DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME } from "../../src/data/taxonomyOps";
import { createTaxonomyOpsClient } from "../../src/data/taxonomyOps.client";
import { TermInUseError, TermNotFoundError, TermRuleError } from "../../src/data/taxonomyRepo";
import { createTaxonomyRepoClient } from "../../src/data/taxonomyRepo.client";
import { renderRules } from "../../src/lib/renderRules";

const OWNER = "testOwnerUid1234567890";
let env: RulesTestEnvironment;
const fs = (x: unknown) => x as Firestore;
const db = () => fs(env.authenticatedContext(OWNER).firestore());
const ops = () => createTaxonomyOpsClient(db(), OWNER);
const posts = () => createPostRepoClient(db(), OWNER);
const cats = () => createTaxonomyRepoClient(db(), OWNER, "categories");
const tags = () => createTaxonomyRepoClient(db(), OWNER, "tags");
const series = () => createTaxonomyRepoClient(db(), OWNER, "series");

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

const mk = (title: string) => posts().create({ title, body: "{}" });

describe("পোস্টের সংগঠন-ফিল্ড", () => {
  it("patch লেখে/পড়ে; null দিলে ফিল্ড সরে; পুরনো পোস্টে default [] ", async () => {
    const p = await mk("এক");
    expect((await posts().get(p.id))?.tagIds).toEqual([]);
    const c = await cats().create({ name: "ভ্রমণ" });
    const t = await tags().create({ name: "সৈকত" });
    const s = await series().create({ name: "ছায়াপথ" });
    await posts().update(p.id, {
      contentType: "travel",
      categoryId: c.id,
      categoryName: c.name,
      tagIds: [t.id],
      tagNames: [t.name],
      seriesId: s.id,
      seriesOrder: 3,
    });
    expect(await posts().get(p.id)).toMatchObject({
      contentType: "travel",
      categoryId: c.id,
      categoryName: "ভ্রমণ",
      tagIds: [t.id],
      tagNames: ["সৈকত"],
      seriesId: s.id,
      seriesOrder: 3,
    });
    await posts().update(p.id, { seriesId: null, seriesOrder: null });
    const after = await posts().get(p.id);
    expect(after?.seriesId).toBeUndefined();
    expect(after?.seriesOrder).toBeUndefined();
    expect(after?.categoryId).toBe(c.id);
  });

  it("অসম tagIds/tagNames ও একপাক্ষিক category আটকায়", async () => {
    const p = await mk("এক");
    await expect(posts().update(p.id, { tagIds: ["a"], tagNames: [] })).rejects.toThrow();
    await expect(posts().update(p.id, { tagIds: ["a"] })).rejects.toThrow();
    await expect(posts().update(p.id, { categoryId: "x" })).rejects.toThrow();
  });
});

describe("rename-propagation", () => {
  it("category rename: সব পোস্টের categoryName বদলায়, updatedAt অক্ষত; প্রকাশিত-সংখ্যা ফেরত", async () => {
    const c = await cats().create({ name: "ভ্রমণ" });
    const a = await mk("এ");
    const b = await mk("বি");
    for (const p of [a, b]) await posts().update(p.id, { categoryId: c.id, categoryName: c.name });
    await posts().update(a.id, { status: "published", visibility: "public" });
    const before = (await posts().get(a.id))?.updatedAt;
    const r = await ops().rename("categories", c.id, "পথ-কথা");
    expect(r).toEqual({ updated: 2, publishedAffected: 1, failed: 0 });
    expect((await posts().get(a.id))?.categoryName).toBe("পথ-কথা");
    expect((await posts().get(b.id))?.categoryName).toBe("পথ-কথা");
    expect((await posts().get(a.id))?.updatedAt).toEqual(before);
    expect((await cats().get(c.id))?.slug).toBe("ভ্রমণ");
  });

  it("tag rename: শুধু ওই সূচকের নাম বদলায়; আবার চালালে updated=০ (idempotent)", async () => {
    const t1 = await tags().create({ name: "সৈকত" });
    const t2 = await tags().create({ name: "ভোর" });
    const p = await mk("এ");
    await posts().update(p.id, { tagIds: [t1.id, t2.id], tagNames: [t1.name, t2.name] });
    expect((await ops().rename("tags", t2.id, "সকাল")).updated).toBe(1);
    expect((await posts().get(p.id))?.tagNames).toEqual(["সৈকত", "সকাল"]);
    expect((await ops().propagateName("tags", t2.id)).updated).toBe(0);
  });

  it("propagateName ভাঙা অবস্থা ঠিক করে (term বদলেছে, পোস্ট পুরনো)", async () => {
    const c = await cats().create({ name: "ক" });
    const p = await mk("এ");
    await posts().update(p.id, { categoryId: c.id, categoryName: "ক" });
    await cats().update(c.id, { name: "খ" }); // propagate ছাড়া — আংশিক ব্যর্থতার মতো
    expect((await ops().propagateName("categories", c.id)).updated).toBe(1);
    expect((await posts().get(p.id))?.categoryName).toBe("খ");
  });
});

describe("remove (delete-guard)", () => {
  it("ব্যবহৃত term মোছা যায় না (trashed লেখা-সহ); খালি হলে যায়", async () => {
    const t = await tags().create({ name: "সৈকত" });
    const p = await mk("এ");
    await posts().update(p.id, { tagIds: [t.id], tagNames: [t.name] });
    await posts().trash(p.id);
    await expect(ops().remove("tags", t.id)).rejects.toBeInstanceOf(TermInUseError);
    await posts().update(p.id, { tagIds: [], tagNames: [] });
    await ops().remove("tags", t.id);
    expect(await tags().get(t.id)).toBeNull();
  });

  it("series ব্যবহৃত হলে মোছা যায় না", async () => {
    const s = await series().create({ name: "ছায়াপথ" });
    const p = await mk("এ");
    await posts().update(p.id, { seriesId: s.id });
    await expect(ops().remove("series", s.id)).rejects.toBeInstanceOf(TermInUseError);
  });

  it("ডিফল্ট ক্যাটাগরি মোছা যায় না", async () => {
    const d = await ops().ensureDefaultCategory();
    await expect(ops().remove("categories", d.id)).rejects.toBeInstanceOf(TermRuleError);
  });
});

describe("ডিফল্ট ক্যাটাগরি", () => {
  it("ensure idempotent: একটাই ক্যাটাগরি, siteSettings-এ id বসে, অন্য settings অক্ষত", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(fs(ctx.firestore()), "siteSettings", "main"), { siteTitle: "আমার ব্লগ" }),
    );
    const a = await ops().ensureDefaultCategory();
    const b = await ops().ensureDefaultCategory();
    expect(a).toEqual({ id: DEFAULT_CATEGORY_ID, name: DEFAULT_CATEGORY_NAME });
    expect(b).toEqual(a);
    expect(await cats().list()).toHaveLength(1);
    const s = (await getDoc(doc(db(), "siteSettings", "main"))).data();
    expect(s).toMatchObject({ siteTitle: "আমার ব্লগ", defaultCategoryId: DEFAULT_CATEGORY_ID });
    expect(await ops().getDefaultCategoryId()).toBe(DEFAULT_CATEGORY_ID);
  });

  it("setDefaultCategory: বিদ্যমান ক্যাটাগরি ডিফল্ট হয়, অন্য settings অক্ষত, idempotent; অজানা id ব্যর্থ", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(fs(ctx.firestore()), "siteSettings", "main"), { siteTitle: "আমার ব্লগ" }),
    );
    const c = await cats().create({ name: "ভ্রমণ" });
    await ops().setDefaultCategory(c.id);
    await ops().setDefaultCategory(c.id);
    expect(await ops().getDefaultCategoryId()).toBe(c.id);
    expect((await getDoc(doc(db(), "siteSettings", "main"))).data()).toMatchObject({ siteTitle: "আমার ব্লগ" });
    await expect(ops().setDefaultCategory("nope")).rejects.toBeInstanceOf(TermNotFoundError);
    expect(await ops().getDefaultCategoryId()).toBe(c.id); // ব্যর্থ ডাকে বদলায়নি
    // নতুন ডিফল্ট হওয়ায় পুরনোটা মোছা-যোগ্য, নতুনটা নয়
    await expect(ops().remove("categories", c.id)).rejects.toBeInstanceOf(TermRuleError);
  });
});

describe("Migration 001 (backfill)", () => {
  it("dry-run কিছু লেখে না; আসল run শুধু ক্যাটাগরিহীন (trashed বাদ) পোস্টে বসায়; পুনরায় চালালে ০", async () => {
    const c = await cats().create({ name: "ভ্রমণ" });
    const a = await mk("ক্যাটাগরিহীন-১");
    const b = await mk("ক্যাটাগরিহীন-২");
    const keep = await mk("আছে");
    const gone = await mk("ট্র্যাশে");
    await posts().update(keep.id, { categoryId: c.id, categoryName: c.name });
    await posts().trash(gone.id);

    const dry = await ops().backfillDefaultCategory({ dryRun: true });
    expect(dry).toMatchObject({ missing: 2, updated: 0 });
    expect(await cats().get(DEFAULT_CATEGORY_ID)).toBeNull(); // dry-run default বানায় না
    expect((await posts().get(a.id))?.categoryId).toBeUndefined();

    const run = await ops().backfillDefaultCategory({ dryRun: false });
    expect(run).toMatchObject({ missing: 2, updated: 2, failed: 0 });
    for (const p of [a, b]) {
      expect(await posts().get(p.id)).toMatchObject({ categoryId: DEFAULT_CATEGORY_ID, categoryName: DEFAULT_CATEGORY_NAME });
    }
    expect((await posts().get(keep.id))?.categoryId).toBe(c.id);
    expect((await posts().get(gone.id))?.categoryId).toBeUndefined();
    expect((await posts().get(a.id))?.title).toBe("ক্যাটাগরিহীন-১"); // বাকি ফিল্ড অক্ষত
    expect(await ops().backfillDefaultCategory({ dryRun: false })).toMatchObject({ missing: 0, updated: 0 });
  });
});
