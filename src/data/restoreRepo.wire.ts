// ব্রাউজারে owner-এর RestoreTarget জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { RestoreTarget } from "@/lib/restore";

export async function getRestoreTarget(): Promise<RestoreTarget> {
  const [{ db }, { createRestoreTargetClient }] = await Promise.all([
    getOwnerDb(),
    import("@/data/restoreRepo.client"),
  ]);
  return createRestoreTargetClient(db);
}
