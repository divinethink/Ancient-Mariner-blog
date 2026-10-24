import { describe, expect, it } from "vitest";
import { BACKUP_FORMAT } from "./backup";
import {
  decodeBackupValue,
  dryRun,
  isValidDocId,
  parseBackupTexts,
  runRestore,
  type RestoreEntry,
  type RestoreTarget,
} from "./restore";

const file = (collections: Record<string, unknown[]>, over: Record<string, unknown> = {}) =>
  JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: "x", collections, ...over });
const e = (id: string, data: Record<string, unknown> = { t: 1 }) => ({ id, data });

function target(initial: Record<string, string[]> = {}, failOn?: string) {
  const store: Record<string, Map<string, RestoreEntry>> = {};
  for (const [c, ids] of Object.entries(initial))
    store[c] = new Map(ids.map((i) => [i, e(i, { old: true })]));
  const writes: string[] = [];
  const t: RestoreTarget = {
    existingIds: async (c, ids) => new Set(ids.filter((i) => store[c]?.has(i))),
    write: async (c, entries) => {
      if (c === failOn) throw new Error("x");
      store[c] ??= new Map();
      for (const x of entries) {
        store[c].set(x.id, x);
        writes.push(`${c}/${x.id}`);
      }
    },
  };
  return { t, store, writes };
}
const parsed = (cols: Record<string, unknown[]>) => {
  const r = parseBackupTexts([file(cols)]);
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
};

describe("parseBackupTexts", () => {
  it("একাধিক ফাইল মেলায়; অজানা collection বাদ; অবৈধ doc গোনে; duplicate-এ পরেরটা", () => {
    const r = parseBackupTexts([
      file({ posts: [e("a"), e("b")] }),
      file({
        posts: [e("b", { v: 2 }), { id: "bad/id", data: {} }],
        future: [e("z")],
        slugs: [e("বাংলা")],
      }),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.collections.posts.map((x) => x.id)).toEqual(["a", "b"]);
    expect(r.value.collections.posts[1].data).toEqual({ v: 2 });
    expect(r.value.collections.slugs[0].id).toBe("বাংলা");
    expect(r.value.skippedCollections).toEqual(["future"]);
    expect(r.value.invalidDocs).toBe(1);
    expect(r.value.duplicateDocs).toBe(1);
  });
  it("ভুল ফাইল আটকায়: JSON নয়, অন্য format, নতুন version, আকার, খালি", () => {
    expect(parseBackupTexts(["{"])).toEqual({ ok: false, error: { code: "not_json", file: 0 } });
    expect(parseBackupTexts([JSON.stringify({ format: "x" })])).toMatchObject({
      ok: false,
      error: { code: "wrong_format" },
    });
    expect(parseBackupTexts([file({ posts: [e("a")] }, { version: 99 })])).toMatchObject({
      ok: false,
      error: { code: "newer_version" },
    });
    expect(parseBackupTexts([file({ posts: "no" as unknown as unknown[] })])).toMatchObject({
      ok: false,
      error: { code: "bad_shape" },
    });
    expect(parseBackupTexts([file({ posts: [] })])).toMatchObject({
      ok: false,
      error: { code: "empty" },
    });
  });
  it("doc-id যাচাই", () => {
    expect(["", "a/b", ".", "..", "__x__"].some(isValidDocId)).toBe(false);
    expect(isValidDocId("কক্সবাজার-ডায়েরি")).toBe(true);
  });
});

describe("decodeBackupValue", () => {
  it("$timestamp গভীরে রূপান্তর; অবৈধ = null", () => {
    const out = decodeBackupValue(
      { a: { $timestamp: "2026-01-01T00:00:00.000Z" }, l: [{ $timestamp: "bad" }], s: "x" },
      (i) => `TS:${i}`,
    );
    expect(out).toEqual({ a: "TS:2026-01-01T00:00:00.000Z", l: [null], s: "x" });
  });
});

describe("dryRun / runRestore", () => {
  it("ডিফল্ট: শুধু অনুপস্থিত যোগ, বিদ্যমান অক্ষত", async () => {
    const { t, store } = target({ posts: ["a"] });
    const p = parsed({ posts: [e("a"), e("b")] });
    const d = await dryRun(p, t);
    expect(d.rows.posts).toEqual({ total: 2, add: 1, existing: 1 });
    expect(Object.keys(store.posts)).toHaveLength(0); // dry-run কিছু লেখেনি
    const r = await runRestore(p, t, { overwrite: false });
    expect(r).toMatchObject({ added: 1, overwritten: 0, skippedExisting: 1, failedDocs: 0 });
    expect(store.posts.get("a")!.data).toEqual({ old: true });
    expect(store.posts.get("b")).toBeDefined();
  });
  it("overwrite: posts বদলায়, কিন্তু বিদ্যমান slugs নয়; নতুন slug যোগ হয়", async () => {
    const { t, store } = target({ posts: ["a"], slugs: ["s1"] });
    const r = await runRestore(parsed({ posts: [e("a")], slugs: [e("s1"), e("s2")] }), t, {
      overwrite: true,
    });
    expect(r).toMatchObject({ overwritten: 1, added: 1, skippedExisting: 1 });
    expect(store.posts.get("a")!.data).toEqual({ t: 1 });
    expect(store.slugs.get("s1")!.data).toEqual({ old: true });
  });
  it("idempotent: দ্বিতীয় রানে কিছু যোগ হয় না; ব্যর্থ chunk গোনা, বাকি চলে", async () => {
    const { t } = target();
    const p = parsed({ posts: [e("a")], notes: [e("n")] });
    await runRestore(p, t, { overwrite: false });
    expect(await runRestore(p, t, { overwrite: false })).toMatchObject({
      added: 0,
      skippedExisting: 2,
    });
    const f = target({}, "posts");
    const r = await runRestore(p, f.t, { overwrite: false });
    expect(r).toMatchObject({ failedDocs: 1, failedChunks: 1, added: 1 });
  });
});

describe("comments — backup-এ আছে, client-restore-এ নয় (rules: client write false)", () => {
  it("dry-run: comments-এর add=০; run: কিছু লেখে না, বাকি collection স্বাভাবিক", async () => {
    const p = parsed({ posts: [e("p1")], comments: [e("c1"), e("c2")] });
    const { t, writes } = target();
    const plan = await dryRun(p, t);
    expect(plan.rows.comments).toEqual({ total: 2, add: 0, existing: 0 });
    expect(plan.add).toBe(1);
    const r = await runRestore(p, t, { overwrite: true });
    expect(writes).toEqual(["posts/p1"]);
    expect(r.added).toBe(1);
    expect(r.failedDocs).toBe(0);
  });
});
