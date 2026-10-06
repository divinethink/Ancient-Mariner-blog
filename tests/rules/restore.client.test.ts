// restore-drill (Checklist P5b-৩): export → খালি DB-তে restore → doc-সংখ্যা ও field সমান — আসল rules-এর নিচে, owner-CSR পথে
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDocs, setDoc, Timestamp, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBackupSourceClient } from "../../src/data/backupRepo.client";
import { createRestoreTargetClient } from "../../src/data/restoreRepo.client";
import { BACKUP_COLLECTIONS, exportBackup } from "../../src/lib/backup";
import { renderRules } from "../../src/lib/renderRules";
import { dryRun, parseBackupTexts, runRestore } from "../../src/lib/restore";

const OWNER = "testOwnerUid1234567890";
let env: RulesTestEnvironment;
const fs = (x: unknown) => x as Firestore;
const ownerDb = () => fs(env.authenticatedContext(OWNER).firestore());
const T = (iso: string) => Timestamp.fromDate(new Date(iso));

const post = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  slug: title,
  status: "published",
  visibility: "public",
  ownerUid: OWNER,
  body: "{}",
  createdAt: T("2026-01-02T03:04:05.678Z"),
  updatedAt: T("2026-02-03T00:00:00Z"),
  publishedAt: T("2026-01-05T00:00:00Z"),
  tagIds: ["t1"],
  seo: { title: "x", noindex: false },
  ...extra,
});
const SEED: Record<string, Record<string, Record<string, unknown>>> = {
  posts: { p1: post("এক"), p2: post("দুই", { status: "draft", visibility: "private" }) },
  slugs: { এক: { postId: "p1", ownerUid: OWNER }, দুই: { postId: "p2", ownerUid: OWNER } },
  siteSettings: {
    main: { siteTitle: "ব্লগ", ownerUid: OWNER, updatedAt: T("2026-03-01T00:00:00Z") },
  },
  notes: { n1: { content: "নোট", organized: false, ownerUid: OWNER } },
};

async function seed(data = SEED) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [c, docs] of Object.entries(data))
      for (const [id, d] of Object.entries(docs)) await setDoc(doc(fs(ctx.firestore()), c, id), d);
  });
}
async function dump(): Promise<Record<string, Record<string, Record<string, unknown>>>> {
  const out: Record<string, Record<string, Record<string, unknown>>> = {};
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const c of BACKUP_COLLECTIONS) {
      const snap = await getDocs(collection(fs(ctx.firestore()), c));
      if (snap.size) out[c] = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
    }
  });
  return out;
}
async function exportText(): Promise<string> {
  const parts: string[] = [];
  await exportBackup(createBackupSourceClient(ownerDb()), { sink: (c) => parts.push(c) });
  return parts.join("");
}

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

describe("restore-drill (Emulator, owner rules)", () => {
  it("export → খালি DB → restore: doc-সংখ্যা ও সব field (Timestamp-সহ, বাংলা id) সমান", async () => {
    await seed();
    const before = await dump();
    const text = await exportText();
    await env.clearFirestore();
    const p = parseBackupTexts([text]);
    if (!p.ok) throw new Error(p.error.code);
    const target = createRestoreTargetClient(ownerDb());
    const d = await dryRun(p.value, target);
    expect(d).toMatchObject({ total: 6, add: 6, existing: 0 });
    const r = await runRestore(p.value, target, { overwrite: false });
    expect(r).toMatchObject({ added: 6, failedDocs: 0 });
    expect(await dump()).toEqual(before);
  });

  it("ডিফল্ট মোডে বিদ্যমান doc অক্ষত; overwrite-এ posts বদলায়, বিদ্যমান slug নয়", async () => {
    await seed();
    const text = await exportText();
    const p = parseBackupTexts([text]);
    if (!p.ok) throw new Error(p.error.code);
    await env.clearFirestore(); // শুধু নিচের দুটো এখন আছে — বাকি ৪টা অনুপস্থিত
    await seed({
      posts: { p1: post("নতুন-লেখা") },
      slugs: { এক: { postId: "NEW", ownerUid: OWNER } },
    });
    const target = createRestoreTargetClient(ownerDb());

    const r1 = await runRestore(p.value, target, { overwrite: false });
    expect(r1).toMatchObject({ added: 4, skippedExisting: 2, failedDocs: 0 });
    let now = await dump();
    expect(now.posts.p1.title).toBe("নতুন-লেখা");

    const r2 = await runRestore(p.value, target, { overwrite: true });
    expect(r2).toMatchObject({ failedDocs: 0 });
    now = await dump();
    expect(now.posts.p1.title).toBe("এক");
    expect(now.slugs["এক"].postId).toBe("NEW"); // slugs কখনো overwrite নয়
  });

  it("Drive-ধরনের প্রতি-collection ফাইলও একই parser-এ restore হয়", async () => {
    await seed();
    const before = await dump();
    const whole = JSON.parse(await exportText()) as { collections: Record<string, unknown[]> };
    const files = Object.entries(whole.collections).map(([c, docs]) =>
      JSON.stringify({
        format: "ancient-mariner-backup",
        version: 1,
        exportedAt: "x",
        collections: { [c]: docs },
        counts: { [c]: docs.length },
      }),
    );
    await env.clearFirestore();
    const p = parseBackupTexts(files);
    if (!p.ok) throw new Error(p.error.code);
    await runRestore(p.value, createRestoreTargetClient(ownerDb()), { overwrite: false });
    expect(await dump()).toEqual(before);
  });
});
