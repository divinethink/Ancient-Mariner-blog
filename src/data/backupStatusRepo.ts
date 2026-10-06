// backupStatusRepo = interface + Zod boundary; `backups/{id}` = সম্পূর্ণ সফল backup-এর রেকর্ড (Arch §৬)।
// adapter: .client.ts (পথ ক, owner read-only — rules-এ write নেই)। লেখে শুধু backup job (privileged/backupDoc.ts, P5b-২)।
// নাম `backupRepo` নয় — ওটা JSON-export-এর উৎস (collection পড়া); এটা backup-মেটা।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import { BackupStatus, BackupType } from "@/lib/enums";

export const BACKUP_SCHEMA_VERSION = 1;

export const BackupMetaSchema = z.object({
  type: BackupType.catch("auto"),
  format: z.string().default("json"),
  status: BackupStatus.catch("complete"),
  /** Drive-এর তারিখ-ফোল্ডারের id */
  driveFolderId: z.string().min(1),
  /** collection → doc-সংখ্যা (যাচাই-করা) */
  counts: z.record(z.string(), z.number().int().min(0)).default({}),
  completedAt: z.date(),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(BACKUP_SCHEMA_VERSION),
});
export type BackupMeta = z.infer<typeof BackupMetaSchema>;
export type BackupMetaWithId = BackupMeta & { id: string };

export const parseBackupMeta = (id: string, raw: Record<string, unknown>): BackupMetaWithId => ({
  ...BackupMetaSchema.parse(normalizeRaw(raw)),
  id,
});

/** পথ ক (owner-CSR, শুধু পড়া) */
export interface BackupStatusRepo {
  /** `completedAt` অবরোহী (নতুন আগে); বিকৃত doc বাদ */
  list(opts?: { limit?: number }): Promise<BackupMetaWithId[]>;
  /** সর্বশেষ সফল backup; একটাও না থাকলে null */
  latest(): Promise<BackupMetaWithId | null>;
}
