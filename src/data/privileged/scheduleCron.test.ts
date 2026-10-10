import { describe, expect, it } from "vitest";
import { publishDue } from "./scheduleCron";
import type { AdminDb, CommitResult, PublishOp, QueryDoc } from "./firestoreAdmin";

const NOW = Date.UTC(2026, 9, 10, 12, 0);
const doc = (id: string, h: number | null, ut = `T-${id}`): QueryDoc => ({
  id,
  updateTime: ut,
  data: { status: "scheduled", ...(h === null ? {} : { scheduledAt: new Date(Date.UTC(2026, 9, 10, h, 0)) }) },
});
const mk = (docs: QueryDoc[], res: (op: PublishOp) => CommitResult = () => "ok") => {
  const ops: PublishOp[] = [];
  const queries: Record<string, unknown>[] = [];
  const db = {
    async runQuery(q: Record<string, unknown>) {
      queries.push(q);
      return { docs };
    },
    async commitPublish(op: PublishOp) {
      ops.push(op);
      return res(op);
    },
  } as unknown as AdminDb;
  return { db, ops, queries };
};
const log = { info: () => undefined, warn: () => undefined };

describe("publishDue", () => {
  it("শুধু status==scheduled query; সময়-হওয়াগুলো পুরনো-আগে publish; publishedAt = scheduledAt", async () => {
    const { db, ops, queries } = mk([doc("late", 13), doc("b", 11), doc("a", 9)]);
    const r = await publishDue(db, NOW, log);
    expect(JSON.stringify(queries[0])).toContain('"scheduled"');
    expect(JSON.stringify(queries[0])).not.toContain("body");
    expect(r).toEqual({ scanned: 3, due: 2, published: 2, skipped: 0 });
    expect(ops.map((o) => o.id)).toEqual(["a", "b"]);
    expect(ops[0]).toMatchObject({ ifUpdateTime: "T-a", publishedAt: new Date(Date.UTC(2026, 9, 10, 9, 0)), nowMs: NOW });
  });
  it("scheduledAt নেই = ছোঁয়া হয় না; precondition-ব্যর্থ = skipped, বাকি চলে", async () => {
    const { db, ops } = mk([doc("none", null), doc("x", 8), doc("y", 9)], (op) => (op.id === "x" ? "precondition" : "ok"));
    const r = await publishDue(db, NOW, log);
    expect(ops.map((o) => o.id)).toEqual(["x", "y"]);
    expect(r).toMatchObject({ due: 2, published: 1, skipped: 1 });
  });
  it("কিছু না থাকলে কোনো লেখা নেই", async () => {
    const { db, ops } = mk([]);
    expect(await publishDue(db, NOW, log)).toEqual({ scanned: 0, due: 0, published: 0, skipped: 0 });
    expect(ops).toEqual([]);
  });
});
