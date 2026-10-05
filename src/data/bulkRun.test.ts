import { describe, expect, it, vi } from "vitest";
import type { BulkPost, BulkUpdate } from "@/lib/bulk";
import { runBulk, type BulkDeps } from "./bulkRun";

const now = new Date("2026-10-06T00:00:00Z");
const P = (id: string, o: Partial<BulkPost> = {}): BulkPost => ({
  id,
  status: "draft",
  visibility: "private",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...o,
});

function deps(posts: BulkPost[], o: Partial<BulkDeps> = {}) {
  const committed: BulkUpdate[][] = [];
  const d: BulkDeps = {
    syncDirty: vi.fn(async () => undefined),
    dirtyIds: vi.fn(async () => new Set<string>()),
    loadPosts: vi.fn(async (ids) => posts.filter((p) => ids.includes(p.id))),
    maxSeriesOrder: vi.fn(async () => 0),
    ensureDefaultCategory: vi.fn(async () => ({ id: "default-other", name: "অন্যান্য" })),
    commit: vi.fn(async (ups: readonly BulkUpdate[]) => {
      committed.push([...ups]);
      return {
        updatedIds: ups.map((u) => u.id),
        failedIds: [],
        affectsPublic: ups.filter((u) => u.affectsPublic).length,
      };
    }),
    deletePermanently: vi.fn(async () => undefined),
    deleteLocal: vi.fn(async () => undefined),
    now: () => now,
    ...o,
  };
  return { d, committed };
}

describe("runBulk", () => {
  it("publish: ক্যাটাগরিহীন থাকলে ডিফল্ট নিশ্চিত; ফল গণনা; affectsPublic", async () => {
    const { d, committed } = deps([
      P("a"),
      P("b", { categoryId: "x", categoryName: "X" }),
      P("p", { status: "published" }),
    ]);
    const s = await runBulk(d, { kind: "publish", ids: ["a", "b", "p", "gone"] });
    expect(d.ensureDefaultCategory).toHaveBeenCalledTimes(1);
    expect(committed[0].map((u) => u.id)).toEqual(["a", "b"]);
    expect(committed[0][0].patch.categoryId).toBe("default-other");
    expect(committed[0][1].patch.categoryId).toBeUndefined();
    expect(s).toMatchObject({
      requested: 4,
      updated: 2,
      unchanged: 1,
      missing: 1,
      affectsPublic: 2,
      failedIds: [],
    });
  });
  it("publish: সবার ক্যাটাগরি থাকলে ensureDefaultCategory ডাকা হয় না", async () => {
    const { d } = deps([P("a", { categoryId: "x", categoryName: "X" })]);
    await runBulk(d, { kind: "publish", ids: ["a"] });
    expect(d.ensureDefaultCategory).not.toHaveBeenCalled();
  });
  it("status-ক্রিয়ায় অসংরক্ষিত লোকাল সম্পাদনা থাকা লেখা বাদ; metadata-ক্রিয়ায় বাদ নয়", async () => {
    const posts = [P("a"), P("b")];
    const { d, committed } = deps(posts, { dirtyIds: vi.fn(async () => new Set(["a"])) });
    const s = await runBulk(d, { kind: "publish", ids: ["a", "b"] });
    expect(committed[0].map((u) => u.id)).toEqual(["b"]);
    expect(s.unsynced).toBe(1);
    const m = deps(posts, { dirtyIds: vi.fn(async () => new Set(["a"])) });
    const s2 = await runBulk(m.d, { kind: "visibility", to: "public", ids: ["a", "b"] });
    expect(m.committed[0].map((u) => u.id)).toEqual(["a", "b"]);
    expect(s2.unsynced).toBe(0);
  });
  it("syncDirty ব্যর্থ হলেও চলে (dirty লেখা বাদ পড়ে)", async () => {
    const { d, committed } = deps([P("a")], {
      syncDirty: vi.fn(async () => {
        throw new Error("net");
      }),
    });
    await runBulk(d, { kind: "archive", ids: ["a"] });
    expect(committed[0]).toHaveLength(1);
  });
  it("series: পর্ব-নম্বর maxSeriesOrder+১ থেকে, নির্বাচিতরা exclude", async () => {
    const { d, committed } = deps(
      [P("a"), P("b", { createdAt: new Date("2025-01-01T00:00:00Z") })],
      {
        maxSeriesOrder: vi.fn(async () => 4),
      },
    );
    await runBulk(d, { kind: "series", id: "s", name: "S", ids: ["a", "b"] });
    expect(d.maxSeriesOrder).toHaveBeenCalledWith("s", new Set(["a", "b"]));
    expect(committed[0].map((u) => [u.id, u.patch.seriesOrder])).toEqual([
      ["a", 6],
      ["b", 5],
    ]);
  });
  it("trash: সফল লেখার লোকাল ড্রাফট মোছে; আংশিক ব্যর্থতা failedIds-এ; একই request আবার = বাকিগুলো", async () => {
    const posts = [P("a"), P("b")];
    const { d } = deps(posts, {
      commit: vi.fn(async () => ({ updatedIds: ["a"], failedIds: ["b"], affectsPublic: 0 })),
    });
    const s = await runBulk(d, { kind: "trash", ids: ["a", "b"] });
    expect(d.deleteLocal).toHaveBeenCalledWith(["a"]);
    expect(s).toMatchObject({ updated: 1, failedIds: ["b"] });
    // retry: a এখন trashed ⇒ notApplicable; b আবার চেষ্টা
    const { d: d2, committed } = deps([P("a", { status: "trashed" }), P("b")]);
    const s2 = await runBulk(d2, { kind: "trash", ids: ["a", "b"] });
    expect(committed[0].map((u) => u.id)).toEqual(["b"]);
    expect(s2.notApplicable).toBe(1);
  });
  it("deleteForever: শুধু trashed মোছে; একটা ব্যর্থ হলে বাকিগুলো চলে; progress", async () => {
    const del = vi.fn(async (id: string) => {
      if (id === "t2") throw new Error("x");
    });
    const { d } = deps(
      [
        P("t1", { status: "trashed" }),
        P("t2", { status: "trashed" }),
        P("t3", { status: "trashed" }),
        P("live"),
      ],
      {
        deletePermanently: del,
      },
    );
    const prog: [number, number][] = [];
    const s = await runBulk(d, { kind: "deleteForever", ids: ["t1", "t2", "t3", "live"] }, (a, b) =>
      prog.push([a, b]),
    );
    expect(del).toHaveBeenCalledTimes(3);
    expect(s).toMatchObject({ updated: 2, failedIds: ["t2"], notApplicable: 1 });
    expect(d.deleteLocal).toHaveBeenCalledWith(["t1", "t3"]);
    expect(prog.at(-1)).toEqual([3, 3]);
  });
  it("প্রযোজ্য কিছু না থাকলে commit-ই ডাকা হয় না; ids ডুপ্লিকেট-মুক্ত", async () => {
    const { d } = deps([P("a", { status: "published" })]);
    const s = await runBulk(d, { kind: "publish", ids: ["a", "a"] });
    expect(d.commit).not.toHaveBeenCalled();
    expect(s).toMatchObject({ requested: 1, unchanged: 1, updated: 0 });
  });
});
