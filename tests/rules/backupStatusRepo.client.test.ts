// backupStatusRepo.client-কে আসল rules-এর নিচে Emulator-এ চালানো (Checklist P5b-১)
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBackupStatusRepoClient } from "../../src/data/backupStatusRepo.client";
import { renderRules } from "../../src/lib/renderRules";

const OWNER = "testOwnerUid1234567890";
let env: RulesTestEnvironment;
const fs = (x: unknown) => x as Firestore;
const repo = () => createBackupStatusRepoClient(fs(env.authenticatedContext(OWNER).firestore()));
const seed = (id: string, iso: string, extra: Record<string, unknown> = {}) => {
  const base: Record<string, unknown> = {
    type: "auto",
    format: "json",
    status: "complete",
    driveFolderId: `F-${id}`,
    counts: { posts: 2 },
    completedAt: Timestamp.fromDate(new Date(iso)),
    ownerUid: OWNER,
    createdAt: Timestamp.fromDate(new Date(iso)),
    updatedAt: Timestamp.fromDate(new Date(iso)),
    schemaVersion: 1,
    ...extra,
  };
  // Firestore SDK undefined লিখতে দেয় না — `undefined` মানে ফিল্ডটা doc-এ নেই (পুরনো doc-এর মতো)
  for (const k of Object.keys(base)) if (base[k] === undefined) delete base[k];
  return env.withSecurityRulesDisabled((ctx) => setDoc(doc(fs(ctx.firestore()), "backups", id), base));
};

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

describe("backupStatusRepo.client (Emulator)", () => {
  it("খালি = latest null, list []", async () => {
    expect(await repo().latest()).toBeNull();
    expect(await repo().list()).toEqual([]);
  });
  it("list নতুন আগে; latest = সর্বশেষ completedAt; Date-এ decode", async () => {
    await seed("a", "2026-10-05T20:00:00Z");
    await seed("c", "2026-10-07T20:00:00Z");
    await seed("b", "2026-10-06T20:00:00Z");
    expect((await repo().list()).map((x) => x.id)).toEqual(["c", "b", "a"]);
    const l = await repo().latest();
    expect(l?.id).toBe("c");
    expect(l?.completedAt.toISOString()).toBe("2026-10-07T20:00:00.000Z");
    expect(l?.counts).toEqual({ posts: 2 });
  });
  it("বিকৃত doc বাদ যায়, বাকিগুলো আসে; নতুন optional ফিল্ডের অভাবে ভাঙে না", async () => {
    await seed("bad", "2026-10-08T20:00:00Z", { driveFolderId: "" });
    await seed("ok", "2026-10-07T20:00:00Z", { format: undefined, schemaVersion: undefined, counts: undefined });
    const r = await repo().list();
    expect(r.map((x) => x.id)).toEqual(["ok"]);
    expect(r[0].format).toBe("json");
  });
});
