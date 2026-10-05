// ব্রাউজারে owner-এর ব্যাকআপ-উৎস জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { BackupSource } from "@/lib/backup";

export async function getBackupSource(): Promise<BackupSource> {
  const [{ db }, { createBackupSourceClient }] = await Promise.all([getOwnerDb(), import("@/data/backupRepo.client")]);
  return createBackupSourceClient(db);
}
