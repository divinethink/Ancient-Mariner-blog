import { describe, expect, it } from "vitest";
import type { AdminDb, CommitResult, QueryDoc } from "./firestoreAdmin";
import { pruneRevisions, purgeTrash } from "./revisionCron";
import type { DeleteOp } from "../../lib/prune";

const D = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const log = { info: () => {}, warn: () => {} };

type Script = {
  queries: (q: Record<string, unknown>) => { docs: QueryDoc[]; truncatedAt?: number };
  batchGet?: (c: string, ids: readonly string[]) => { found: QueryDoc[]; missing: string[] };
  commit?: (ops: readonly DeleteOp[]) => CommitResult;
};
function fakeDb(s: Script) {
  const queries: Record<string, unknown>[] = [];
  const commits: DeleteOp[][] = [];
  const db: AdminDb = {
    async runQuery(q) {
      queries.push(q);
      return s.queries(q);
    },
    async batchGet(c, ids) {
      return s.batchGet ? s.batchGet(c, ids) : { found: [], missing: [] };
    },
    async commitDeletes(ops) {
      commits.push([...ops]);
      return s.commit ? s.commit(ops) : "ok";
    },
    async commitPublish() {
      return "ok";
    },
    async setCommentStatus() {
      return "ok";
    },
    async createComment() {
      return "created";
    },
  };
  return { db, queries, commits };
}
const collectionOf = (q: Record<string, unknown>) =>
  (q.from as { collectionId: string }[])[0].collectionId;
const post = (id: string, daysAgo: number, extra: Record<string, unknown> = {}): QueryDoc => ({
  id,
  updateTime: `T-${id}`,
  data: { status: "trashed", trashedAt: new Date(NOW - daysAgo * D), slug: `slug-${id}`, ...extra },
});

describe("purgeTrash", () => {
  it("query শুধু status==trashed, body/snapshot select-এ নেই", async () => {
    const f = fakeDb({ queries: () => ({ docs: [] }) });
    await purgeTrash(f.db, NOW, log);
    const q = f.queries[0] as {
      where: { fieldFilter: { field: { fieldPath: string }; value: unknown } };
      select: { fields: { fieldPath: string }[] };
    };
    expect(q.where.fieldFilter.field.fieldPath).toBe("status");
    expect(q.where.fieldFilter.value).toEqual({ stringValue: "trashed" });
    expect(q.select.fields.map((x) => x.fieldPath)).not.toContain("body");
    expect(f.commits).toEqual([]);
  });

  it("৭+ দিনের trashed মোছে (post+নিজের slug-lock+draft+revision); নতুন trashed ও অন্য status ছোঁয় না", async () => {
    const f = fakeDb({
      queries: (q) =>
        collectionOf(q) === "posts"
          ? {
              docs: [
                post("OLD", 8, { slugHistory: ["older"] }),
                post("NEW", 2),
                post("PUB", 30, { status: "published" }), // query ভুল করে আনলেও lib আটকায়
              ],
            }
          : {
              docs: [
                { id: "r1", data: { targetType: "post", targetId: "OLD" } },
                { id: "r2", data: { targetType: "post", targetId: "OLD" } },
                { id: "rX", data: { targetType: "post", targetId: "NEW" } }, // অনুরোধ-বহির্ভূত → বাদ
              ],
            },
      batchGet: () => ({
        found: [
          { id: "slug-OLD", data: { postId: "OLD" } },
          { id: "older", data: { postId: "SOMEONE-ELSE" } }, // অন্যের lock — মোছা নয়
        ],
        missing: [],
      }),
    });
    const r = await purgeTrash(f.db, NOW, log);
    expect(r.purgedPosts).toBe(1);
    expect(f.commits).toHaveLength(1);
    expect(f.commits[0]).toEqual([
      { collection: "revisions", id: "r1" },
      { collection: "revisions", id: "r2" },
      { collection: "slugs", id: "slug-OLD" },
      { collection: "drafts", id: "OLD" },
      { collection: "posts", id: "OLD", ifUpdateTime: "T-OLD" },
    ]);
    const all = f.commits.flat();
    expect(
      all.some((o) => o.id === "NEW" || o.id === "PUB" || o.id === "rX" || o.id === "older"),
    ).toBe(false);
  });

  it("precondition ব্যর্থ (পুনরুদ্ধার-race) হলে skip, purged গোনা নয়", async () => {
    const f = fakeDb({
      queries: (q) => (collectionOf(q) === "posts" ? { docs: [post("OLD", 9)] } : { docs: [] }),
      commit: () => "precondition",
    });
    const r = await purgeTrash(f.db, NOW, log);
    expect(r.purgedPosts).toBe(0);
    expect(r.skipped).toBe(1);
  });

  it("revision-scan truncated হলে লেখা/slug/draft মোছা নয়, শুধু revision", async () => {
    const f = fakeDb({
      queries: (q) =>
        collectionOf(q) === "posts"
          ? { docs: [post("OLD", 9)] }
          : { docs: [{ id: "r1", data: { targetType: "post", targetId: "OLD" } }], truncatedAt: 1 },
    });
    const r = await purgeTrash(f.db, NOW, log);
    expect(r.purgedPosts).toBe(0);
    expect(f.commits.flat().every((o) => o.collection === "revisions")).toBe(true);
  });

  it("কিছু due না হলে revisions/slugs query বা commit নেই", async () => {
    const f = fakeDb({ queries: () => ({ docs: [post("NEW", 1)] }) });
    await purgeTrash(f.db, NOW, log);
    expect(f.queries).toHaveLength(1);
    expect(f.commits).toEqual([]);
  });
});

describe("pruneRevisions", () => {
  const rev = (id: string, targetId: string, n: number): QueryDoc => ({
    id,
    data: { targetType: "post", targetId, versionNumber: n },
  });
  const many = (t: string, count: number) =>
    Array.from({ length: count }, (_, i) => rev(`${t}-${i + 1}`, t, i + 1)).reverse();

  it("২২টা থাকলে সবচেয়ে পুরনো ২টা মোছে; ২০টা থাকলে কিছু না", async () => {
    const f = fakeDb({
      queries: (q) => {
        if ((q.orderBy as unknown) === undefined)
          return {
            docs: ["A", "B"].map((t) => ({
              id: `x${t}`,
              data: { targetType: "post", targetId: t },
            })),
          };
        const filters = (
          q.where as {
            compositeFilter: { filters: { fieldFilter: { value: { stringValue: string } } }[] };
          }
        ).compositeFilter.filters;
        const t = filters[1].fieldFilter.value.stringValue;
        return { docs: t === "A" ? many("A", 22) : many("B", 20) };
      },
      batchGet: () => ({ found: [], missing: [] }),
    });
    const r = await pruneRevisions(f.db, NOW, log);
    expect(r.deletedRevisions).toBe(2);
    expect(
      f.commits
        .flat()
        .map((o) => o.id)
        .sort(),
    ).toEqual(["A-1", "A-2"]);
    expect(f.commits.flat().every((o) => o.collection === "revisions" && !o.ifUpdateTime)).toBe(
      true,
    );
  });

  it("লেখা নেই (batchGet missing) হলে ঐ target-এর সব revision মোছে", async () => {
    const f = fakeDb({
      queries: (q) =>
        (q.orderBy as unknown) === undefined
          ? { docs: [{ id: "x", data: { targetType: "post", targetId: "GONE" } }] }
          : { docs: many("GONE", 3) },
      batchGet: () => ({ found: [], missing: ["GONE"] }),
    });
    const r = await pruneRevisions(f.db, NOW, log);
    expect(r.orphanTargets).toBe(1);
    expect(f.commits.flat()).toHaveLength(3);
  });

  it("সাম্প্রতিক revision না থাকলে কিছুই নয়", async () => {
    const f = fakeDb({ queries: () => ({ docs: [] }) });
    const r = await pruneRevisions(f.db, NOW, log);
    expect(r.deletedRevisions).toBe(0);
    expect(f.commits).toEqual([]);
  });

  it("recent-query-র জানালা = ২ দিন আগে থেকে", async () => {
    const f = fakeDb({ queries: () => ({ docs: [] }) });
    await pruneRevisions(f.db, NOW, log);
    const q = f.queries[0] as {
      where: { fieldFilter: { op: string; value: { timestampValue: string } } };
    };
    expect(q.where.fieldFilter.op).toBe("GREATER_THAN_OR_EQUAL");
    expect(q.where.fieldFilter.value.timestampValue).toBe(new Date(NOW - 2 * D).toISOString());
  });
});
