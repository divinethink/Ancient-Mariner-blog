// ব্রাউজারে owner-এর CommentRepo জোগান (lazy)
import type { CommentRepo } from "@/data/commentRepo";
import { getOwnerDb } from "@/data/ownerDb";

export async function getCommentRepo(): Promise<CommentRepo> {
  const [{ db }, { createCommentRepoClient }] = await Promise.all([getOwnerDb(), import("@/data/commentRepo.client")]);
  return createCommentRepoClient(db);
}
