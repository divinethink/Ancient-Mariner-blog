// Privileged allowlist ১-এর owner-দিক (P11b-২): মালিকের মন্তব্য-ব্যবস্থাপনা — লুকানো/ফেরানো, মোছা, উত্তর। rules-এ client write নেই, তাই এই সংকীর্ণ পথ।
// route (`/api/owner/comments`) middleware-এর session + Origin যাচাইয়ের পর ডাকে। প্রতিটা ক্রিয়া idempotent (একই ক্রিয়া আবার = একই ফল)।
import { COMMENT_SCHEMA_VERSION, type Comment } from "../commentRepo";
import type { AdminDb } from "./firestoreAdmin";

export type ModerateResult = { kind: "ok"; duplicate?: boolean } | { kind: "not_found" } | { kind: "bad_parent" } | { kind: "conflict" };

/** লুকানো (spam) / ফেরানো (approved); doc না থাকলে not_found */
export async function setStatus(db: AdminDb, id: string, status: "approved" | "spam", nowMs: number): Promise<ModerateResult> {
  const r = await db.setCommentStatus({ id, status, nowMs });
  return r === "ok" ? { kind: "ok" } : { kind: "not_found" };
}

/** মন্তব্য + তার সব reply এক atomic commit-এ মোছা (reply অনাথ থাকে না); না থাকলেও সফল (delete idempotent) */
export async function removeComment(db: AdminDb, id: string): Promise<ModerateResult> {
  const { docs } = await db.runQuery({
    from: [{ collectionId: "comments" }],
    where: { fieldFilter: { field: { fieldPath: "parentCommentId" }, op: "EQUAL", value: { stringValue: id } } },
    select: { fields: [{ fieldPath: "postId" }] },
    limit: 200,
  });
  const ops = [...docs.map((d) => ({ collection: "comments" as const, id: d.id })), { collection: "comments" as const, id }];
  const r = await db.commitDeletes(ops);
  return r === "ok" ? { kind: "ok" } : { kind: "conflict" };
}

/** লেখকের উত্তর: parent একই-সূত্রের top-level ও approved হতে হবে; postId parent থেকে নেওয়া (client-এর ওপর ভরসা নয়) */
export async function replyAsOwner(
  db: AdminDb,
  p: { commentId: string; parentCommentId: string; content: string },
  ownerUid: string,
  authorName: string,
  nowMs: number,
): Promise<ModerateResult> {
  const parents = await db.batchGet("comments", [p.parentCommentId], ["postId", "status", "parentCommentId"]);
  const par = parents.found[0]?.data;
  if (!par || typeof par.postId !== "string" || par.status !== "approved" || par.parentCommentId) return { kind: "bad_parent" };
  const now = new Date(nowMs);
  const comment: Comment = {
    postId: par.postId,
    authorName,
    content: p.content,
    status: "approved",
    parentCommentId: p.parentCommentId,
    byOwner: true,
    ownerUid,
    createdAt: now,
    updatedAt: now,
    schemaVersion: COMMENT_SCHEMA_VERSION,
  };
  const r = await db.createComment({ id: p.commentId, comment });
  return { kind: "ok", duplicate: r === "exists" };
}
