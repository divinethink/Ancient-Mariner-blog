// mediaRepo.client-কে আসল rules-এর নিচে Emulator-এ চালানো (Checklist P6-১)
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import type { Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MediaNotFoundError } from "../../src/data/mediaRepo";
import { createMediaRepoClient } from "../../src/data/mediaRepo.client";
import { renderRules } from "../../src/lib/renderRules";

const OWNER = "testOwnerUid1234567890";
let env: RulesTestEnvironment;
const fs = (x: unknown) => x as Firestore;
const repo = () => createMediaRepoClient(fs(env.authenticatedContext(OWNER).firestore()), OWNER);

const pub = (n: number, o: Record<string, unknown> = {}) => ({
  id: `pubMedia${String(n).padStart(4, "0")}`,
  cloudinaryPublicId: `blog/pub${n}`,
  cloudinaryUrl: `https://res.cloudinary.com/demo/image/upload/blog/pub${n}`,
  deliveryType: "upload" as const,
  visibility: "public" as const,
  fileName: `ছবি-${n}.jpg`,
  type: "image" as const,
  size: 1000 + n,
  width: 1600,
  height: 900,
  ...o,
});
const priv = (n: number) => ({
  id: `privMedia${String(n).padStart(3, "0")}`,
  cloudinaryPublicId: `blog/priv${n}`,
  deliveryType: "authenticated" as const,
  visibility: "private" as const,
  fileName: `diary-${n}.pdf`,
  type: "file" as const,
  size: 5000,
});

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

describe("mediaRepo.client (Emulator)", () => {
  it("create → get; ownerUid/schemaVersion/timestamp বসে", async () => {
    const a = await repo().create(pub(1));
    expect(a.ownerUid).toBe(OWNER);
    expect(a.schemaVersion).toBe(1);
    expect(a.createdAt).toBeInstanceOf(Date);
    expect((await repo().get(a.id))?.fileName).toBe("ছবি-1.jpg");
    expect(await repo().get("nope")).toBeNull();
  });

  it("একই id-তে দ্বিতীয় create idempotent (duplicate নয়, মান অপরিবর্তিত)", async () => {
    const a = await repo().create(pub(1));
    const b = await repo().create(pub(1, { fileName: "অন্য.jpg" }));
    expect(b.id).toBe(a.id);
    expect(b.fileName).toBe("ছবি-1.jpg");
    expect((await repo().list()).items).toHaveLength(1);
  });

  it("কঠোর create: private+URL, public+authenticated, public-এ location, URL-ছাড়া public ছবি, অবৈধ public_id প্রত্যাখ্যাত", async () => {
    await expect(repo().create({ ...priv(1), cloudinaryUrl: "https://x.test/a.jpg" })).rejects.toThrow();
    await expect(repo().create(pub(2, { deliveryType: "authenticated" }))).rejects.toThrow();
    await expect(repo().create(pub(3, { location: "কক্সবাজার" }))).rejects.toThrow();
    await expect(repo().create(pub(4, { capturedAt: new Date() }))).rejects.toThrow();
    await expect(repo().create(pub(5, { cloudinaryUrl: undefined }))).rejects.toThrow();
    await expect(repo().create(pub(6, { cloudinaryPublicId: "../x" }))).rejects.toThrow();
    await expect(repo().create(pub(7, { cloudinaryUrl: "http://insecure.test/a.jpg" }))).rejects.toThrow();
    expect((await repo().list()).items).toHaveLength(0);
  });

  it("private ফাইল তৈরি হয় (location/capturedAt চলে), URL থাকে না", async () => {
    const p = await repo().create({ ...priv(1), location: "ঢাকা", capturedAt: new Date("2026-09-12T01:00:00Z") });
    expect(p.cloudinaryUrl).toBeUndefined();
    expect(p.location).toBe("ঢাকা");
    expect(p.capturedAt?.toISOString()).toBe("2026-09-12T01:00:00.000Z");
  });

  it("list: নতুন আগে, type-filter, cursor-pagination (পাতা পূর্ণ হলে next, শেষে undefined)", async () => {
    for (let i = 1; i <= 3; i++) {
      await repo().create(pub(i));
      await new Promise((r) => setTimeout(r, 15)); // createdAt আলাদা
    }
    await repo().create(priv(1));
    const all = await repo().list({ limit: 10 });
    expect(all.items).toHaveLength(4);
    expect(all.next).toBeUndefined();
    expect(all.items[0].type).toBe("file"); // সবচেয়ে নতুন
    const imgs = await repo().list({ type: "image", limit: 2 });
    expect(imgs.items.map((x) => x.cloudinaryPublicId)).toEqual(["blog/pub3", "blog/pub2"]);
    expect(imgs.next).toBeInstanceOf(Date);
    const rest = await repo().list({ type: "image", limit: 2, after: imgs.next });
    expect(rest.items.map((x) => x.cloudinaryPublicId)).toEqual(["blog/pub1"]);
    expect(rest.next).toBeUndefined();
  });

  it("updateMeta: altText/caption বদলায়, একই মান দ্বিতীয়বার = বদল নেই (updatedAt অক্ষত); না-থাকায় MediaNotFoundError", async () => {
    const a = await repo().create(pub(1));
    const b = await repo().updateMeta(a.id, { altText: "ভোরের সৈকত", caption: "কক্সবাজার" });
    expect(b.altText).toBe("ভোরের সৈকত");
    expect(b.fileName).toBe(a.fileName); // অন্য ফিল্ড অক্ষত
    const c = await repo().updateMeta(a.id, { altText: "ভোরের সৈকত" });
    expect(c.updatedAt.getTime()).toBe(b.updatedAt.getTime());
    await expect(repo().updateMeta("nope", { altText: "x" })).rejects.toBeInstanceOf(MediaNotFoundError);
    await expect(repo().updateMeta(a.id, { altText: "ক".repeat(301) })).rejects.toThrow();
  });

  it("delete: doc মোছে; না থাকলেও সফল", async () => {
    const a = await repo().create(pub(1));
    await repo().delete(a.id);
    await repo().delete(a.id);
    expect(await repo().get(a.id)).toBeNull();
  });
});
