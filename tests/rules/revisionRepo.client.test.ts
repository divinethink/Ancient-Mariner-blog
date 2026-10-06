// revisionRepo.client-কে আসল rules-এর নিচে Emulator-এ চালানো (Checklist P5a-১)
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import type { Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createRevisionRepoClient } from "../../src/data/revisionRepo.client";
import { renderRules } from "../../src/lib/renderRules";

const OWNER = "testOwnerUid1234567890";
let env: RulesTestEnvironment;
const fs = (x: unknown) => x as Firestore;
const repo = () => createRevisionRepoClient(fs(env.authenticatedContext(OWNER).firestore()), OWNER);
const snap = (t: string) => JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] });

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

describe("revisionRepo.client (Emulator)", () => {
  it("create: versionNumber ১,২,৩; ownerUid/trigger/schemaVersion বসে; list নতুন আগে", async () => {
    const a = await repo().create({ targetId: "post1", snapshot: snap("এক"), trigger: "publish" });
    const b = await repo().create({ targetId: "post1", snapshot: snap("দুই"), trigger: "manual" });
    const c = await repo().create({ targetId: "post1", snapshot: snap("তিন"), trigger: "interval" });
    expect([a.versionNumber, b.versionNumber, c.versionNumber]).toEqual([1, 2, 3]);
    expect(a.ownerUid).toBe(OWNER);
    expect(a.targetType).toBe("post");
    expect(a.schemaVersion).toBe(1);
    expect((await repo().list("post1")).map((r) => r.versionNumber)).toEqual([3, 2, 1]);
    expect((await repo().list("post1", { limit: 2 })).length).toBe(2);
  });

  it("প্রতি লেখার নিজস্ব ইতিহাস ও নিজস্ব সংখ্যা", async () => {
    await repo().create({ targetId: "p1", snapshot: snap("ক"), trigger: "manual" });
    const x = await repo().create({ targetId: "p2", snapshot: snap("খ"), trigger: "manual" });
    expect(x.versionNumber).toBe(1);
    expect((await repo().list("p1")).length).toBe(1);
    expect((await repo().list("nope")).length).toBe(0);
  });

  it("idempotent: একই id-তে দ্বিতীয় create নতুন doc বানায় না", async () => {
    const a = await repo().create({ id: "rev1", targetId: "post1", snapshot: snap("এক"), trigger: "manual" });
    const b = await repo().create({ id: "rev1", targetId: "post1", snapshot: snap("বদল"), trigger: "manual" });
    expect(b.id).toBe(a.id);
    expect(b.snapshot).toBe(a.snapshot);
    expect((await repo().list("post1")).length).toBe(1);
  });

  it("অবৈধ ইনপুট আটকায়: বড় snapshot, অবৈধ trigger/targetId", async () => {
    const big = "আ".repeat(310_000); // ≈ ৯৩০ KB UTF-8
    await expect(repo().create({ targetId: "post1", snapshot: big, trigger: "manual" })).rejects.toThrow();
    await expect(
      repo().create({ targetId: "post1", snapshot: snap("x"), trigger: "bogus" as never }),
    ).rejects.toThrow();
    await expect(repo().create({ targetId: "../x", snapshot: snap("x"), trigger: "manual" })).rejects.toThrow();
    expect((await repo().list("post1")).length).toBe(0);
  });
});
