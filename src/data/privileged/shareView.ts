// Privileged allowlist ৮ (Arch §২): share-link পাঠ — শুধু `/share/[token]` পেজ থেকে। সংকীর্ণ: নির্দিষ্ট ৩ doc-get (shareLinks, posts, drafts), কোনো লেখা নেই, কোনো query নেই।
// token → SHA-256 → doc-ID; অচল (নেই/revoked/মেয়াদ-শেষ/trashed/বিকৃত) সব একই `gone` — কারণ জানানো হয় না (oracle নয়)।
import { parseShareLink } from "../shareLinkRepo";
import { hashShareToken } from "../shareToken";
import { SHARE_TOKEN_RE, shareState } from "../../lib/shareLink";
import type { AdminDb } from "./firestoreAdmin";

export type ShareView = { kind: "gone" } | { kind: "ok"; title: string; body: string; expiresAt: Date };

const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function resolveShare(db: AdminDb, token: string, nowMs: number): Promise<ShareView> {
  if (!SHARE_TOKEN_RE.test(token)) return { kind: "gone" };
  const id = await hashShareToken(token);
  const { found } = await db.batchGet("shareLinks", [id], ["postId", "postTitle", "ownerUid", "createdAt", "expiresAt", "revokedAt", "schemaVersion"]);
  if (found.length === 0) return { kind: "gone" };
  let link;
  try {
    link = parseShareLink(id, found[0].data);
  } catch {
    return { kind: "gone" };
  }
  if (shareState(link, nowMs) !== "active") return { kind: "gone" };

  const [posts, drafts] = await Promise.all([
    db.batchGet("posts", [link.postId], ["title", "body", "status"]),
    db.batchGet("drafts", [link.postId], ["title", "body"]),
  ]);
  const post = posts.found[0]?.data;
  if (!post || post.status === "trashed") return { kind: "gone" };
  // প্রকাশিত লেখায় অপ্রকাশিত সম্পাদনা (drafts) থাকলে সেটাই — রিভিউয়ারের জন্য সর্বশেষ রূপ
  const d = drafts.found[0]?.data;
  const body = str(d?.body) || str(post.body);
  if (!body) return { kind: "gone" };
  return { kind: "ok", title: str(d?.title) || str(post.title), body, expiresAt: link.expiresAt };
}
