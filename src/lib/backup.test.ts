import { describe, expect, it } from "vitest";
import {
  BACKUP_COLLECTIONS,
  backupFileName,
  encodeValue,
  exportBackup,
  readPercent,
  type BackupCollection,
  type BackupDoc,
  type BackupSource,
} from "./backup";

function fake(data: Partial<Record<BackupCollection, BackupDoc[]>>): BackupSource & { pages: number } {
  const s = {
    pages: 0,
    count: async (c: BackupCollection) => (data[c] ?? []).length,
    readPage: async (c: BackupCollection, after: string | undefined, size: number) => {
      s.pages++;
      const all = [...(data[c] ?? [])].sort((a, b) => a.id.localeCompare(b.id));
      const i = after === undefined ? 0 : all.findIndex((d) => d.id === after) + 1;
      return all.slice(i, i + size);
    },
  };
  return s;
}

describe("encodeValue", () => {
  it("Date ও Timestamp-সদৃশ → $timestamp; nested; undefined বাদ", () => {
    const d = new Date("2026-01-02T03:04:05.000Z");
    const out = encodeValue({ a: d, b: { toDate: () => d }, c: [d, undefined], e: undefined, f: "বাংলা", g: null });
    expect(out).toEqual({
      a: { $timestamp: d.toISOString() },
      b: { $timestamp: d.toISOString() },
      c: [{ $timestamp: d.toISOString() }, null],
      f: "বাংলা",
      g: null,
    });
  });
  it("অবৈধ Date → null", () => {
    expect(encodeValue(new Date("x"))).toBeNull();
  });
});

describe("exportBackup", () => {
  const docs = (n: number): BackupDoc[] =>
    Array.from({ length: n }, (_, i) => ({ id: `p${String(i).padStart(3, "0")}`, data: { t: `লেখা ${i}`, at: new Date(0) } }));

  it("একাধিক পাতা: বৈধ JSON, প্রতিটি doc একবার, count মেলে", async () => {
    const src = fake({ posts: docs(250), slugs: docs(3) });
    const chunks: string[] = [];
    const r = await exportBackup(src, { sink: (c) => chunks.push(c), pageSize: 100, now: new Date("2026-10-05T00:00:00Z") });
    const j = JSON.parse(chunks.join(""));
    expect(j.format).toBe("ancient-mariner-backup");
    expect(j.version).toBe(1);
    expect(j.collections.posts).toHaveLength(250);
    expect(new Set(j.collections.posts.map((d: { id: string }) => d.id)).size).toBe(250);
    expect(j.collections.posts[0].data.at).toEqual({ $timestamp: "1970-01-01T00:00:00.000Z" });
    expect(j.collections.drafts).toEqual([]);
    expect(j.counts).toEqual({ posts: 250, drafts: 0, slugs: 3, siteSettings: 0, ideas: 0, notes: 0 });
    expect(r.total).toBe(253);
    expect(Object.keys(j.collections)).toEqual([...BACKUP_COLLECTIONS]);
  });
  it("ঠিক পাতা-আকারের গুণিতকে অতিরিক্ত খালি পাতা পড়ে কিন্তু ফল ঠিক", async () => {
    const chunks: string[] = [];
    await exportBackup(fake({ posts: docs(100) }), { sink: (c) => chunks.push(c), pageSize: 100 });
    expect(JSON.parse(chunks.join("")).counts.posts).toBe(100);
  });
  it("সম্পূর্ণ খালি → বৈধ JSON", async () => {
    const chunks: string[] = [];
    await exportBackup(fake({}), { sink: (c) => chunks.push(c) });
    expect(JSON.parse(chunks.join("")).counts).toEqual({ posts: 0, drafts: 0, slugs: 0, siteSettings: 0, ideas: 0, notes: 0 });
  });
  it("abort হলে throw", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(exportBackup(fake({ posts: docs(1) }), { sink: () => {}, signal: ac.signal })).rejects.toThrow();
  });
  it("source ব্যর্থ হলে error ছড়ায় (নীরবে আংশিক ফাইল নয়)", async () => {
    const bad: BackupSource = { count: async () => 0, readPage: async () => Promise.reject(new Error("net")) };
    await expect(exportBackup(bad, { sink: () => {} })).rejects.toThrow("net");
  });
});

describe("helpers", () => {
  it("ফাইলের নাম UTC-ভিত্তিক", () => {
    expect(backupFileName(new Date("2026-10-05T07:08:00Z"))).toBe("ancient-mariner-backup-20261005-0708.json");
  });
  it("readPercent", () => {
    expect(readPercent(5000)).toBe(10);
    expect(readPercent(123)).toBe(0.2);
  });
});
