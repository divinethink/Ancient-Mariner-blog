// ব্রাউজারে owner-এর IdeaRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { IdeaRepo } from "@/data/ideaRepo";

export async function getIdeaRepo(): Promise<IdeaRepo> {
  const [{ db, uid }, { createIdeaRepoClient }] = await Promise.all([
    getOwnerDb(),
    import("@/data/ideaRepo.client"),
  ]);
  return createIdeaRepoClient(db, uid);
}
