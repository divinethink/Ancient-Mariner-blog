// ব্রাউজারে owner-এর RevisionRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { RevisionRepo } from "@/data/revisionRepo";

export async function getRevisionRepo(): Promise<RevisionRepo> {
  const [{ db, uid }, { createRevisionRepoClient }] = await Promise.all([
    getOwnerDb(),
    import("@/data/revisionRepo.client"),
  ]);
  return createRevisionRepoClient(db, uid);
}
