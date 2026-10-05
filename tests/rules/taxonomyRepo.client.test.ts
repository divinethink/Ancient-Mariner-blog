// taxonomyRepo.client-কে আসল rules-এর নিচে Emulator-এ চালানো (Checklist P3a-১)
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TermRuleError } from "../../src/data/taxonomyRepo";
import { createTaxonomyRepoClient } from "../../src/data/taxonomyRepo.client";
import { renderRules } from "../../src/lib/renderRules";

const OWNER = "testOwnerUid1234567890";
let env: RulesTestEnvironment;
const fs = (x: unknown) => x as Firestore;
const ownerDb = () => fs(env.authenticatedContext(OWNER).firestore());
const cats = () => createTaxonomyRepoClient(ownerDb(), OWNER, "categories");
const tags = () => createTaxonomyRepoClient(ownerDb(), OWNER, "tags");

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

describe("taxonomyRepo.client (Emulator)", () => {
  it("create → get/list; ownerUid/schemaVersion বসে; বাংলা slug", async () => {
    const c = await cats().create({ name: "ভ্রমণ", description: "পথের গল্প" });
    expect(c.slug).toBe("ভ্রমণ");
    expect(c.ownerUid).toBe(OWNER);
    expect(c.schemaVersion).toBe(1);
    expect((await cats().list()).map((x) => x.id)).toEqual([c.id]);
  });

  it("একই id-তে দ্বিতীয় create idempotent (duplicate নয়)", async () => {
    const a = await cats().create({ id: "fixedId0000000000001", name: "ডায়েরি" });
    const b = await cats().create({ id: "fixedId0000000000001", name: "ডায়েরি" });
    expect(b.id).toBe(a.id);
    expect(await cats().list()).toHaveLength(1);
  });

  it("একই নামে দ্বিতীয় term-এর slug-এ suffix; collection আলাদা হলে সংঘাত নেই", async () => {
    const a = await cats().create({ name: "গল্প" });
    const b = await cats().create({ name: "গল্প" });
    expect(a.slug).toBe("গল্প");
    expect(b.slug).toBe("গল্প-২");
    expect((await tags().create({ name: "গল্প" })).slug).toBe("গল্প");
  });

  it("update: নাম বদলায়, slug অপরিবর্তিত", async () => {
    const c = await cats().create({ name: "ভ্রমণ" });
    const u = await cats().update(c.id, { name: "ভ্রমণ-কথা", description: "নতুন" });
    expect(u.name).toBe("ভ্রমণ-কথা");
    expect(u.slug).toBe("ভ্রমণ");
    expect(u.description).toBe("নতুন");
  });

  it("অবৈধ নাম throw, কিছু লেখা হয় না", async () => {
    await expect(cats().create({ name: "   " })).rejects.toThrow();
    expect(await cats().list()).toHaveLength(0);
  });

  it("parent নিয়ম: ২ স্তর, নিজে-নিজের parent নয়, সন্তান থাকলে delete ব্যর্থ", async () => {
    const p = await cats().create({ name: "ভ্রমণ" });
    const c = await cats().create({ name: "কক্সবাজার", parentCategoryId: p.id });
    expect(c.parentCategoryId).toBe(p.id);
    await expect(cats().create({ name: "তৃতীয়", parentCategoryId: c.id })).rejects.toBeInstanceOf(TermRuleError);
    await expect(cats().update(p.id, { parentCategoryId: p.id })).rejects.toBeInstanceOf(TermRuleError);
    await expect(cats().update(p.id, { parentCategoryId: c.id })).rejects.toBeInstanceOf(TermRuleError);
    await expect(cats().delete(p.id)).rejects.toBeInstanceOf(TermRuleError);
    const top = await cats().update(c.id, { parentCategoryId: null });
    expect(top.parentCategoryId).toBeUndefined();
    await cats().delete(p.id);
    expect(await cats().get(p.id)).toBeNull();
  });

  it("tags-এ parent নিষিদ্ধ", async () => {
    await expect(tags().create({ name: "x", parentCategoryId: "any" })).rejects.toBeInstanceOf(TermRuleError);
  });

  it("বিকৃত doc list ভাঙে না; পুরনো doc-এ অনুপস্থিত ফিল্ড default পায়", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = fs(ctx.firestore());
      await setDoc(doc(d, "categories", "bad"), { name: 5 });
      await setDoc(doc(d, "categories", "old"), {
        name: "পুরনো",
        slug: "পুরনো",
        ownerUid: OWNER,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
    const l = await cats().list();
    expect(l.map((x) => x.id)).toEqual(["old"]);
    expect(l[0].description).toBe("");
  });

  it("non-owner create ব্যর্থ", async () => {
    const anon = createTaxonomyRepoClient(fs(env.unauthenticatedContext().firestore()), "x", "tags");
    await expect(anon.create({ name: "হ্যাক" })).rejects.toThrow();
  });
});
