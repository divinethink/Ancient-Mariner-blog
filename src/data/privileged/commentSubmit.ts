// Privileged allowlist ১ (Arch §২): পাঠকের মন্তব্য-জমা — সংকীর্ণ: posts/comments-এর doc-get ও `comments` নতুন-doc create; query নেই, অন্য কিছু লেখা নেই।
// owner-সিদ্ধান্ত ২০২৬-১০-১০: মডারেশন নেই ⇒ সাধারণ মন্তব্য সরাসরি 'approved'; অতিরিক্ত-লিংক-যুক্ত = 'spam' (পাবলিকে অদৃশ্য; জমাদাতা আলাদা কিছু টের পায় না)।
import { COMMENT_SCHEMA_VERSION, type Comment } from "../commentRepo";
import { looksSpammy, type CommentPayload } from "../../lib/comments";
import type { AdminDb } from "./firestoreAdmin";

export type SubmitResult =
  | { kind: "ok"; id: string; duplicate: boolean }
  | { kind: "closed" } // পোস্ট নেই/প্রকাশিত-পাবলিক নয়/মন্তব্য বন্ধ
  | { kind: "bad_parent" };

export async function submitComment(db: AdminDb, p: CommentPayload, ownerUid: string, nowMs: number): Promise<SubmitResult> {
  const posts = await db.batchGet("posts", [p.postId], ["status", "visibility", "commentsEnabled"]);
  const post = posts.found[0]?.data;
  // শুধু published+public লেখায় (unlisted/share-link/draft-এ নয়); commentsEnabled অনুপস্থিত = true (Arch §৬)
  if (!post || post.status !== "published" || post.visibility !== "public" || post.commentsEnabled === false) return { kind: "closed" };

  if (p.parentCommentId) {
    const parents = await db.batchGet("comments", [p.parentCommentId], ["postId", "status", "parentCommentId"]);
    const par = parents.found[0]?.data;
    // ১-স্তর reply: parent একই পোস্টের, approved ও নিজে reply নয়
    if (!par || par.postId !== p.postId || par.status !== "approved" || par.parentCommentId) return { kind: "bad_parent" };
  }

  const now = new Date(nowMs);
  const comment: Comment = {
    postId: p.postId,
    authorName: p.authorName,
    content: p.content,
    status: looksSpammy(p.authorName, p.content) ? "spam" : "approved",
    ...(p.parentCommentId ? { parentCommentId: p.parentCommentId } : {}),
    ownerUid,
    createdAt: now,
    updatedAt: now,
    schemaVersion: COMMENT_SCHEMA_VERSION,
  };
  const r = await db.createComment({ id: p.commentId, comment });
  return { kind: "ok", id: p.commentId, duplicate: r === "exists" };
}
