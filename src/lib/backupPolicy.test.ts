import { describe, expect, it } from "vitest";
import {
  BACKUP_STALE_DAYS,
  backupFolderName,
  backupPartName,
  findShrink,
  isBackupStale,
  parseBackupFolderName,
  planRetention,
  splitIntoParts,
  type DriveFolder,
} from "./backupPolicy";

const at = (iso: string) => new Date(iso);
const F = (iso: string, o: Partial<DriveFolder> = {}): DriveFolder => {
  const name = backupFolderName(at(iso));
  return { id: `id-${name}`, name, complete: true, ...o };
};

describe("folder-নাম", () => {
  it("UTC-তে তৈরি ও round-trip", () => {
    const n = backupFolderName(at("2026-10-07T20:00:30Z"));
    expect(n).toBe("ancient-mariner-backup-20261007-2000");
    expect(parseBackupFolderName(n)?.toISOString()).toBe("2026-10-07T20:00:00.000Z");
  });
  it("বাইরের/অবৈধ নাম null", () => {
    for (const n of ["photos", "ancient-mariner-backup-20261307-2000", "ancient-mariner-backup-20260230-0000", "ancient-mariner-backup-20261007-2460", "x-ancient-mariner-backup-20261007-2000"])
      expect(parseBackupFolderName(n)).toBeNull();
  });
});

describe("planRetention", () => {
  const now = at("2026-10-31T20:30:00Z");
  const ids = (a: DriveFolder[]) => a.map((f) => f.name.slice(-13));

  it("১১ দৈনিক → শেষ ৭ + রবিবারের সর্বোচ্চ ৪ থাকে, বাকি মোছা", () => {
    const fs = Array.from({ length: 31 }, (_, i) => F(new Date(Date.UTC(2026, 9, 1 + i, 20, 0)).toISOString()));
    const { keep, remove } = planRetention(fs, now);
    // অক্টোবর ২০২৬: রবিবার ৪, ১১, ১৮, ২৫; শেষ ৭ দিন = ২৫–৩১ (২৫ রবিবার, একই)
    expect(ids(keep).sort()).toEqual(
      ["20261004-2000", "20261011-2000", "20261018-2000", "20261025-2000", "20261026-2000", "20261027-2000", "20261028-2000", "20261029-2000", "20261030-2000", "20261031-2000"].sort(),
    );
    expect(keep.length + remove.length).toBe(31);
  });
  it("একই দিনে দুটো auto হলে শুধু সর্বশেষটা", () => {
    const a = F("2026-10-31T02:00:00Z");
    const b = F("2026-10-31T20:00:00Z");
    const { keep, remove } = planRetention([a, b], now);
    expect(keep).toEqual([b]);
    expect(remove).toEqual([a]);
  });
  it("manual backup একই দিনের auto-তে মোছা যায় না", () => {
    const m = F("2026-10-31T02:00:00Z", { type: "manual" });
    const a = F("2026-10-31T20:00:00Z", { type: "auto" });
    expect(planRetention([m, a], now).remove).toEqual([]);
  });
  it("সম্পূর্ণ ফোল্ডার একটাও না থাকলে কিছুই মোছা হয় না", () => {
    const x = F("2026-10-01T02:00:00Z", { complete: false });
    expect(planRetention([x], now)).toEqual({ keep: [x], remove: [] });
  });
  it("অসম্পূর্ণ: ২৪ ঘণ্টার কম = থাকে; বেশি = মোছা", () => {
    const ok = F("2026-10-31T20:00:00Z");
    const fresh = F("2026-10-31T20:10:00Z", { complete: false });
    const stale = F("2026-10-28T20:10:00Z", { complete: false });
    const { keep, remove } = planRetention([ok, fresh, stale], now);
    expect(keep).toContain(fresh);
    expect(remove).toEqual([stale]);
  });
  it("অ্যাপের নামের বাইরের ফোল্ডার কোনো তালিকাতেই নেই", () => {
    const foreign: DriveFolder = { id: "z", name: "my-photos", complete: true };
    const r = planRetention([F("2026-10-31T20:00:00Z"), foreign], now);
    expect([...r.keep, ...r.remove]).not.toContain(foreign);
  });
});

describe("isBackupStale", () => {
  const now = at("2026-10-07T00:00:00Z");
  it("না থাকলে true; ঠিক ৩ দিন = false; ৩ দিনের বেশি = true; ভবিষ্যৎ = false", () => {
    expect(isBackupStale(undefined, now)).toBe(true);
    expect(isBackupStale(new Date(now.getTime() - BACKUP_STALE_DAYS * 86400000), now)).toBe(false);
    expect(isBackupStale(new Date(now.getTime() - BACKUP_STALE_DAYS * 86400000 - 1), now)).toBe(true);
    expect(isBackupStale(new Date(now.getTime() + 5000), now)).toBe(false);
  });
});

describe("splitIntoParts / backupPartName", () => {
  const sz = (n: number) => n;
  it("খালি = ১টা খালি ভাগ; সীমার মধ্যে = ১ ভাগ", () => {
    expect(splitIntoParts([], sz, 10)).toEqual([[]]);
    expect(splitIntoParts([4, 4], sz, 10)).toEqual([[4, 4]]);
  });
  it("সীমা ছাড়ালে ক্রম রেখে নতুন ভাগ; বড় doc একা", () => {
    expect(splitIntoParts([6, 6, 3, 50, 1], sz, 10)).toEqual([[6], [6, 3], [50], [1]]);
  });
  it("কোনো doc হারায় না/দ্বিগুণ হয় না", () => {
    const items = Array.from({ length: 100 }, (_, i) => (i % 7) + 1);
    expect(splitIntoParts(items, sz, 12).flat()).toEqual(items);
  });
  it("ফাইল-নাম", () => {
    expect(backupPartName("posts", 1, 1)).toBe("posts.json");
    expect(backupPartName("posts", 2, 3)).toBe("posts-2.json");
  });
});

describe("findShrink (শ্রিঙ্ক-গার্ড)", () => {
  it("আগের backup না থাকলে বা সংখ্যা কম (<১০) হলে নিষ্ক্রিয়", () => {
    expect(findShrink(undefined, { posts: 0 })).toEqual([]);
    expect(findShrink({ posts: 9 }, { posts: 0 })).toEqual([]);
  });
  it("২০%-এর বেশি কমলে ধরে; ঠিক ২০% বা কম হলে ধরে না", () => {
    expect(findShrink({ posts: 100 }, { posts: 79 })).toEqual([
      { col: "posts", prev: 100, next: 79 },
    ]);
    expect(findShrink({ posts: 100 }, { posts: 80 })).toEqual([]);
    expect(findShrink({ posts: 100 }, { posts: 150 })).toEqual([]);
  });
  it("collection অনুপস্থিত = ০ ধরে; drafts/অন্য collection উপেক্ষিত", () => {
    expect(findShrink({ chapters: 50 }, {})).toEqual([{ col: "chapters", prev: 50, next: 0 }]);
    expect(findShrink({ drafts: 50, ideas: 50 }, { drafts: 0, ideas: 0 })).toEqual([]);
  });
});
