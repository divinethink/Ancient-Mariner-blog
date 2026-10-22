// ব্রাউজারে owner-এর LetterRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { LetterRepo } from "@/data/letterRepo";

export async function getLetterRepo(): Promise<LetterRepo> {
  const [{ db, uid }, { createLetterRepoClient }] = await Promise.all([
    getOwnerDb(),
    import("@/data/letterRepo.client"),
  ]);
  return createLetterRepoClient(db, uid);
}
