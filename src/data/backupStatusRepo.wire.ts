// ব্রাউজারে owner-এর BackupStatusRepo জোগান (lazy)
import type { BackupStatusRepo } from "@/data/backupStatusRepo";
import { getOwnerDb } from "@/data/ownerDb";

export async function getBackupStatusRepo(): Promise<BackupStatusRepo> {
  const [{ db }, { createBackupStatusRepoClient }] = await Promise.all([
    getOwnerDb(),
    import("@/data/backupStatusRepo.client"),
  ]);
  return createBackupStatusRepoClient(db);
}
