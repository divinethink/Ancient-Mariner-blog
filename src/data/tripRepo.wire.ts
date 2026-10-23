// ব্রাউজারে owner-এর TripRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { TripRepo } from "@/data/tripRepo";

export async function getTripRepo(): Promise<TripRepo> {
  const [{ db, uid }, { createTripRepoClient }] = await Promise.all([
    getOwnerDb(),
    import("@/data/tripRepo.client"),
  ]);
  return createTripRepoClient(db, uid);
}
