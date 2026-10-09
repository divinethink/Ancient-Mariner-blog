// ব্রাউজারে owner-এর MediaRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { MediaRepo } from "@/data/mediaRepo";

export async function getMediaRepo(): Promise<MediaRepo> {
  const [{ db, uid }, { createMediaRepoClient }] = await Promise.all([
    getOwnerDb(),
    import("@/data/mediaRepo.client"),
  ]);
  return createMediaRepoClient(db, uid);
}
