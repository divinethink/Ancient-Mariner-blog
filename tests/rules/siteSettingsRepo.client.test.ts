// siteSettingsRepo.client-কে আসল rules-এর নিচে Emulator-এ চালানো (Checklist P2c-১)
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/data/siteSettingsRepo";
import { createSiteSettingsRepoClient } from "../../src/data/siteSettingsRepo.client";
import { renderRules } from "../../src/lib/renderRules";

const OWNER = "testOwnerUid1234567890";
let env: RulesTestEnvironment;
const fs = (x: unknown) => x as Firestore;
const ownerDb = () => fs(env.authenticatedContext(OWNER).firestore());
const repo = () => createSiteSettingsRepoClient(ownerDb(), OWNER);
const valid = { ...DEFAULT_SETTINGS, siteTitle: "আমার ব্লগ", postsPerPage: 12, allowIndexing: true };

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

const raw = async () => {
  let data: Record<string, unknown> | undefined;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const s = await getDoc(doc(fs(ctx.firestore()), "siteSettings", "main"));
    data = s.data();
  });
  return data;
};

describe("siteSettingsRepo.client (Emulator)", () => {
  it("doc নেই → get() defaults", async () => {
    expect(await repo().get()).toEqual(DEFAULT_SETTINGS);
  });

  it("save → get round-trip; ownerUid/schemaVersion/createdAt/updatedAt বসে", async () => {
    await repo().save(valid);
    expect(await repo().get()).toEqual(valid);
    const d = await raw();
    expect(d?.ownerUid).toBe(OWNER);
    expect(d?.schemaVersion).toBe(1);
    expect(d?.createdAt).toBeDefined();
    expect(d?.updatedAt).toBeDefined();
  });

  it("merge: পরের phase-এর ফিল্ড (menu) অক্ষত; layout schema-ভুক্ত, save→get-এ অক্ষত", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(fs(ctx.firestore()), "siteSettings", "main"), {
        siteTitle: "পুরনো",
        menu: [{ label: "ব্লগ", type: "link", ref: "https://x.test" }],
        layout: { sidebar: [{ id: "search", enabled: true }], home: [] },
      });
    });
    // layout এখন schema-ভুক্ত: ফর্ম get() থেকে নেওয়া মান ফেরত সেভ করে, তাই আগের layout অক্ষত থাকে
    const loaded = await repo().get();
    expect(loaded.layout).toEqual({ sidebar: [{ id: "search", enabled: true }], home: [] });
    await repo().save({ ...loaded, siteTitle: "আমার ব্লগ" });
    const d = await raw();
    expect(d?.siteTitle).toBe("আমার ব্লগ");
    expect(d?.menu).toEqual([{ label: "ব্লগ", type: "link", ref: "https://x.test" }]);
    expect(d?.layout).toEqual({ sidebar: [], home: [] }); // P4b-৩: layout এখন schema-ভুক্ত — সেভে input-এর মান লেখা হয়
  });

  it("createdAt শুধু প্রথম সেভে; দ্বিতীয় সেভ idempotent", async () => {
    await repo().save(valid);
    const first = (await raw())?.createdAt;
    await repo().save(valid);
    const d = await raw();
    expect(d?.createdAt).toEqual(first);
    expect(await repo().get()).toEqual(valid);
  });

  it("অবৈধ ইনপুটে throw, কিছু লেখা হয় না", async () => {
    await expect(repo().save({ ...valid, postsPerPage: 99 })).rejects.toThrow();
    await expect(repo().save({ ...valid, timezone: "Mars/Base" })).rejects.toThrow();
    expect(await raw()).toBeUndefined();
  });

  it("non-owner write ব্যর্থ, public read সফল", async () => {
    const anon = createSiteSettingsRepoClient(fs(env.unauthenticatedContext().firestore()), "someoneElse");
    await expect(anon.save(valid)).rejects.toThrow();
    await repo().save(valid);
    expect(await anon.get()).toEqual(valid);
  });
});
