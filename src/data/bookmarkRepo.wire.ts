// ব্রাউজারে owner-এর BookmarkRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { BookmarkRepo } from "@/data/bookmarkRepo";

export async function getBookmarkRepo(): Promise<BookmarkRepo> {
  const [{ db, uid }, { createBookmarkRepoClient }] = await Promise.all([getOwnerDb(), import("@/data/bookmarkRepo.client")]);
  return createBookmarkRepoClient(db, uid);
}
