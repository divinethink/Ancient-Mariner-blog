import { describe, expect, it, vi } from "vitest";
import type { AdminDb, QueryDoc } from "./firestoreAdmin";
import { submitComment } from "./commentSubmit";
import type { CommentPayload } from "../../lib/comments";

const ID = "A".repeat(20);
const P: CommentPayload = { commentId: ID, postId: "P1", authorName: "রহিম", content: "ভালো", turnstileToken: "t" };
const doc = (data: Record<string, unknown>): QueryDoc => ({ id: "x", data });

function fakeDb(docs: Record<string, Record<string, unknown>>, create: "created" | "exists" = "created") {
  const createComment = vi.fn(async () => create);
  const batchGet = vi.fn(async (col: string, ids: readonly string[]) => {
    const d = docs[`${col}/${ids[0]}`];
    return { found: d ? [doc(d)] : [], missing: d ? [] : [ids[0]] };
  });
  return { db: { batchGet, createComment } as unknown as AdminDb, createComment, batchGet };
}
const livePost = { status: "published", visibility: "public" };

describe("submitComment", () => {
  it("সাধারণ মন্তব্য ⇒ সরাসরি approved, ownerUid/schemaVersion সহ", async () => {
    const { db, createComment } = fakeDb({ "posts/P1": livePost });
    expect(await submitComment(db, P, "OWN", 1_000)).toEqual({ kind: "ok", id: ID, duplicate: false, spam: false });
    expect(createComment).toHaveBeenCalledWith({
      id: ID,
      comment: { postId: "P1", authorName: "রহিম", content: "ভালো", status: "approved", ownerUid: "OWN", createdAt: new Date(1_000), updatedAt: new Date(1_000), schemaVersion: 1 },
    });
  });
  it("অতিরিক্ত লিংক ⇒ status 'spam' (তবু ok — জমাদাতা টের পায় না)", async () => {
    const { db, createComment } = fakeDb({ "posts/P1": livePost });
    const r = await submitComment(db, { ...P, content: "http://a.co http://b.co http://c.co" }, "OWN", 1);
    expect(r.kind).toBe("ok");
    expect((createComment.mock.calls[0] as unknown as [{ comment: { status: string } }])[0].comment.status).toBe("spam");
  });
  it.each([
    ["পোস্ট নেই", {}],
    ["draft", { "posts/P1": { status: "draft", visibility: "public" } }],
    ["private", { "posts/P1": { status: "published", visibility: "private" } }],
    ["unlisted", { "posts/P1": { status: "published", visibility: "unlisted" } }],
    ["commentsEnabled=false", { "posts/P1": { ...livePost, commentsEnabled: false } }],
  ])("%s ⇒ closed, কিছু লেখা হয় না", async (_n, docs) => {
    const { db, createComment } = fakeDb(docs as Record<string, Record<string, unknown>>);
    expect(await submitComment(db, P, "OWN", 1)).toEqual({ kind: "closed" });
    expect(createComment).not.toHaveBeenCalled();
  });
  it("commentsEnabled অনুপস্থিত = খোলা", async () => {
    const { db } = fakeDb({ "posts/P1": livePost });
    expect((await submitComment(db, P, "OWN", 1)).kind).toBe("ok");
  });
  it("duplicate (একই commentId) ⇒ ok + duplicate:true", async () => {
    const { db } = fakeDb({ "posts/P1": livePost }, "exists");
    expect(await submitComment(db, P, "OWN", 1)).toEqual({ kind: "ok", id: ID, duplicate: true, spam: false });
  });
  describe("reply", () => {
    const PAR = "B".repeat(20);
    const withParent = { ...P, parentCommentId: PAR };
    it("বৈধ parent ⇒ parentCommentId সহ লেখা", async () => {
      const { db, createComment } = fakeDb({ "posts/P1": livePost, [`comments/${PAR}`]: { postId: "P1", status: "approved" } });
      expect((await submitComment(db, withParent, "OWN", 1)).kind).toBe("ok");
      expect((createComment.mock.calls[0] as unknown as [{ comment: { parentCommentId: string } }])[0].comment.parentCommentId).toBe(PAR);
    });
    it.each([
      ["parent নেই", {}],
      ["অন্য পোস্টের", { postId: "P2", status: "approved" }],
      ["spam/pending parent", { postId: "P1", status: "spam" }],
      ["parent নিজেই reply (১-স্তর সীমা)", { postId: "P1", status: "approved", parentCommentId: "C".repeat(20) }],
    ])("%s ⇒ bad_parent", async (_n, par) => {
      const docs: Record<string, Record<string, unknown>> = { "posts/P1": livePost };
      if (Object.keys(par).length) docs[`comments/${PAR}`] = par;
      const { db, createComment } = fakeDb(docs);
      expect(await submitComment(db, withParent, "OWN", 1)).toEqual({ kind: "bad_parent" });
      expect(createComment).not.toHaveBeenCalled();
    });
  });
});
