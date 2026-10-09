// templateRepo.client-কে আসল rules-এর নিচে Emulator-এ চালানো (P7b-২)
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import type { Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTemplateRepoClient } from "../../src/data/templateRepo.client";
import { renderRules } from "../../src/lib/renderRules";

const OWNER = "testOwnerUid1234567890";
let env: RulesTestEnvironment;
const fs = (x: unknown) => x as Firestore;
const repo = () => createTemplateRepoClient(fs(env.authenticatedContext(OWNER).firestore()), OWNER);
const body = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

beforeAll(async () => {
  const rules = renderRules(readFileSync("firestore.rules.tpl", "utf8"), OWNER);
  env = await initializeTestEnvironment({
    projectId: "demo-ancientmarinerblog",
    firestore: { rules },
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

describe("templateRepo.client (Emulator)", () => {
  it("create → get/list; ownerUid/schemaVersion বসে", async () => {
    const a = await repo().create({ name: "  আমার ছাঁচ ", body });
    expect(a.name).toBe("আমার ছাঁচ");
    expect(a.ownerUid).toBe(OWNER);
    expect(a.schemaVersion).toBe(1);
    expect((await repo().list()).map((x) => x.id)).toEqual([a.id]);
    expect((await repo().get(a.id))?.body).toBe(body);
  });

  it("একই id-তে দ্বিতীয় create idempotent (duplicate নয়, নাম অপরিবর্তিত)", async () => {
    const a = await repo().create({ id: "tplFixed00000000001", name: "প্রথম", body });
    const b = await repo().create({ id: "tplFixed00000000001", name: "দ্বিতীয়", body });
    expect(b.id).toBe(a.id);
    expect(b.name).toBe("প্রথম");
    expect(await repo().list()).toHaveLength(1);
  });

  it("খালি/সীমা-ছাড়ানো নাম ও খালি body প্রত্যাখ্যাত", async () => {
    await expect(repo().create({ name: "  ", body })).rejects.toThrow();
    await expect(repo().create({ name: "ক".repeat(61), body })).rejects.toThrow();
    await expect(repo().create({ name: "ঠিক", body: "" })).rejects.toThrow();
    expect(await repo().list()).toHaveLength(0);
  });

  it("delete; না-থাকলেও সফল; অন্য ব্যবহারকারী/anonymous পড়তে পারে না", async () => {
    const a = await repo().create({ name: "মুছব", body });
    await repo().delete(a.id);
    await repo().delete(a.id);
    expect(await repo().get(a.id)).toBeNull();
    await repo().create({ id: "tplFixed00000000002", name: "গোপন", body });
    const other = fs(env.authenticatedContext("someoneElse").firestore());
    await expect(createTemplateRepoClient(other, "someoneElse").list()).rejects.toThrow();
    await expect(
      createTemplateRepoClient(fs(env.unauthenticatedContext().firestore()), "x").list(),
    ).rejects.toThrow();
  });
});
