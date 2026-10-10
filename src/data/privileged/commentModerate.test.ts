import { describe, expect, it, vi } from "vitest";
import type { AdminDb, QueryDoc } from "./firestoreAdmin";
import { removeComment, replyAsOwner, setStatus } from "./commentModerate";

const A = "A".repeat(20);
const B = "B".repeat(20);
const doc = (id: string, data: Record<string, unknown> = {}): QueryDoc => ({ id, data });

function fakeDb(o: { parents?: Record<string, Record<string, unknown>>; replies?: string[]; status?: "ok" | "precondition"; create?: "created" | "exists"; del?: "ok" | "precondition" } = {}) {
  const setCommentStatus = vi.fn(async () => o.status ?? "ok");
  const createComment = vi.fn(async () => o.create ?? "created");
  const commitDeletes = vi.fn(async () => o.del ?? "ok");
  const runQuery = vi.fn(async () => ({ docs: (o.replies ?? []).map((id) => doc(id)) }));
  const batchGet = vi.fn(async (_c: string, ids: readonly string[]) => {
    const d = o.parents?.[ids[0]];
    return { found: d ? [doc(ids[0], d)] : [], missing: d ? [] : [ids[0]] };
  });
  return { db: { setCommentStatus, createComment, commitDeletes, runQuery, batchGet } as unknown as AdminDb, setCommentStatus, createComment, commitDeletes, runQuery };
}

describe("setStatus", () => {
  it("ok ⇒ ok; আর শুধু status/nowMs পাঠায়", async () => {
    const f = fakeDb();
    expect(await setStatus(f.db, A, "spam", 5)).toEqual({ kind: "ok" });
    expect(f.setCommentStatus).toHaveBeenCalledWith({ id: A, status: "spam", nowMs: 5 });
  });
  it("doc নেই ⇒ not_found", async () => {
    expect(await setStatus(fakeDb({ status: "precondition" }).db, A, "approved", 5)).toEqual({ kind: "not_found" });
  });
});

describe("removeComment", () => {
  it("মন্তব্য + তার সব reply এক commit-এ", async () => {
    const f = fakeDb({ replies: ["r1", "r2"] });
    expect(await removeComment(f.db, A)).toEqual({ kind: "ok" });
    expect(f.commitDeletes).toHaveBeenCalledWith([
      { collection: "comments", id: "r1" },
      { collection: "comments", id: "r2" },
      { collection: "comments", id: A },
    ]);
  });
  it("reply না থাকলে শুধু নিজে; commit-ব্যর্থ ⇒ conflict", async () => {
    const f = fakeDb();
    await removeComment(f.db, A);
    expect(f.commitDeletes).toHaveBeenCalledWith([{ collection: "comments", id: A }]);
    expect(await removeComment(fakeDb({ del: "precondition" }).db, A)).toEqual({ kind: "conflict" });
  });
});

describe("replyAsOwner", () => {
  const P = { commentId: B, parentCommentId: A, content: "ধন্যবাদ" };
  it("বৈধ parent ⇒ approved + byOwner, postId parent থেকে", async () => {
    const f = fakeDb({ parents: { [A]: { postId: "P9", status: "approved" } } });
    expect(await replyAsOwner(f.db, P, "OWN", "লেখক", 1000)).toEqual({ kind: "ok", duplicate: false });
    expect(f.createComment).toHaveBeenCalledWith({
      id: B,
      comment: { postId: "P9", authorName: "লেখক", content: "ধন্যবাদ", status: "approved", parentCommentId: A, byOwner: true, ownerUid: "OWN", createdAt: new Date(1000), updatedAt: new Date(1000), schemaVersion: 1 },
    });
  });
  it.each([
    ["parent নেই", {}],
    ["parent লুকানো", { [A]: { postId: "P9", status: "spam" } }],
    ["parent নিজেই reply", { [A]: { postId: "P9", status: "approved", parentCommentId: "Z" } }],
  ])("%s ⇒ bad_parent, কিছু লেখা হয় না", async (_n, parents) => {
    const f = fakeDb({ parents: parents as Record<string, Record<string, unknown>> });
    expect(await replyAsOwner(f.db, P, "OWN", "লেখক", 1)).toEqual({ kind: "bad_parent" });
    expect(f.createComment).not.toHaveBeenCalled();
  });
  it("একই commentId আবার ⇒ ok + duplicate", async () => {
    const f = fakeDb({ parents: { [A]: { postId: "P9", status: "approved" } }, create: "exists" });
    expect(await replyAsOwner(f.db, P, "OWN", "লেখক", 1)).toEqual({ kind: "ok", duplicate: true });
  });
});
