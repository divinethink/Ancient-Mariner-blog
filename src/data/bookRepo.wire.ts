// ব্রাউজারে owner-এর BookRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { BookRepo } from "@/data/bookRepo";

export async function getBookRepo(): Promise<BookRepo> {
  const [{ db, uid }, { createBookRepoClient }] = await Promise.all([
    getOwnerDb(),
    import("@/data/bookRepo.client"),
  ]);
  return createBookRepoClient(db, uid);
}
