// ব্রাউজারে owner-এর SpecialDayRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { SpecialDayRepo } from "@/data/specialDayRepo";

export async function getSpecialDayRepo(): Promise<SpecialDayRepo> {
  const [{ db, uid }, { createSpecialDayRepoClient }] = await Promise.all([
    getOwnerDb(),
    import("@/data/specialDayRepo.client"),
  ]);
  return createSpecialDayRepoClient(db, uid);
}
