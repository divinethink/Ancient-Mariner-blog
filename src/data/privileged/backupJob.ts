// Privileged allowlist ৬ (Arch §২): Drive auto-backup-এর যুক্তি। সব বাইরের নির্ভরতা inject — তাই fake দিয়ে unit-test হয়।
// ক্রম (Arch §১৫): collection পড়া → Drive-এ আপলোড → আকার/সংখ্যা যাচাই → `backups` doc (সম্পূর্ণ-চিহ্ন) → শেষে retention-এ পুরনো ফোল্ডার মোছা।
// নতুন backup যাচাই-সম্পূর্ণ না হলে কিছুই মোছা হয় না; ব্যর্থ হলে doc থাকে না (৩ দিনের সতর্কতাই ধরে)। Firestore-এ শুধু পড়া + এক নতুন doc।
import {
  BACKUP_COLLECTIONS,
  BACKUP_FORMAT,
  BACKUP_PAGE_SIZE,
  BACKUP_VERSION,
  encodeValue,
  totalDocs,
  type BackupCollection,
  type BackupDoc,
} from "../../lib/backup";
import {
  BACKUP_FOLDER_PREFIX,
  backupFolderName,
  backupPartName,
  findShrink,
  planRetention,
  splitIntoParts,
  type DriveFolder,
} from "../../lib/backupPolicy";
import type { DriveClient } from "./driveClient";

type Log = {
  info: (m: string, c?: Record<string, unknown>) => void;
  warn: (m: string, c?: Record<string, unknown>) => void;
};

export type BackupJobDeps = {
  /** token-ভিত্তিক পাতা (id-cursor নয় — বাংলা slug-id-তে নিরাপদ); `next` না থাকলে শেষ */
  readPage(
    col: BackupCollection,
    cursor: string | undefined,
    size: number,
  ): Promise<{ docs: BackupDoc[]; next?: string }>;
  drive: Pick<DriveClient, "createFolder" | "uploadJson" | "listBackupFolders" | "deleteFolder">;
  /** `backups` doc লেখা (exists = আগে থেকেই আছে, overwrite নয়) */
  writeDoc(id: string, meta: unknown): Promise<"created" | "exists">;
  /** আগের সম্পূর্ণ backup-গুলো (`backups` doc থেকে) — retention-এর 'complete' চিহ্নের উৎস */
  listCompleted(): Promise<{ driveFolderId: string; type?: "auto" | "manual" }[]>;
  type: "auto" | "manual";
  /** আগের সম্পূর্ণ backup-এর counts — স্বয়ংক্রিয় (auto) backup-এ শ্রিঙ্ক-গার্ডের তুলনা; manual-এ গার্ড নেই (সচেতন সিদ্ধান্ত, নতুন baseline) */
  prevCounts?: Record<string, number>;
  /** প্রতি যাচাইকৃত ফাইল (আপলোডের পর) — অফসাইট/লোকাল কপির জন্য; ব্যর্থ হলে backup ব্যর্থ */
  onFile?: (name: string, content: string) => void | Promise<void>;
  /** জানা না থাকলে পড়া doc-এর `ownerUid` থেকে নেওয়া হয় */
  ownerUid?: string;
  now?: () => Date;
  pageSize?: number;
  log: Log;
};

export type BackupJobResult = {
  folderName: string;
  counts: Record<string, number>;
  total: number;
  files: number;
  removedFolders: number;
  retentionOk: boolean;
};

const byteLen = (s: string) => Buffer.byteLength(s, "utf8");

export async function runBackupJob(deps: BackupJobDeps): Promise<BackupJobResult> {
  const { drive, log } = deps;
  const now = deps.now ?? (() => new Date());
  const startedAt = now();
  const folderName = backupFolderName(startedAt);
  const exportedAt = startedAt.toISOString();
  const pageSize = deps.pageSize ?? BACKUP_PAGE_SIZE;

  const folder = await drive.createFolder(folderName);
  const counts = {} as Record<BackupCollection, number>;
  let derivedOwner: string | undefined;
  let files = 0;

  for (const col of BACKUP_COLLECTIONS) {
    const entries: { id: string; data: unknown }[] = [];
    let cursor: string | undefined;
    for (;;) {
      const { docs, next } = await deps.readPage(col, cursor, pageSize);
      for (const d of docs) {
        entries.push({ id: d.id, data: encodeValue(d.data) });
        if (!derivedOwner && typeof d.data.ownerUid === "string" && d.data.ownerUid)
          derivedOwner = d.data.ownerUid;
      }
      if (!next) break;
      cursor = next;
    }
    counts[col] = entries.length;

    // প্রতি ফাইল = বৈধ ম্যানুয়াল-export-এর মতোই কাঠামো (এক collection) — P5b-৩ restore একই parser-এ পড়বে
    const parts = splitIntoParts(entries, (e) => byteLen(JSON.stringify(e)));
    for (const [i, part] of parts.entries()) {
      if (parts.length > 1 && part.length === 0) continue;
      const name = backupPartName(col, i + 1, parts.length);
      const content = JSON.stringify({
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt,
        collections: { [col]: part },
        counts: { [col]: part.length },
      });
      const up = await drive.uploadJson(folder.id, name, content);
      // যাচাই: Drive-এর নিজের জানানো আকার = আমাদের পাঠানো byte
      if (up.size !== byteLen(content))
        throw new Error(`${name}: আকার মেলেনি (Drive ${up.size ?? "?"} ≠ ${byteLen(content)})`);
      await deps.onFile?.(name, content);
      files++;
    }
  }

  const total = totalDocs(counts);
  if (total === 0)
    throw new Error("সব collection খালি পড়া গেছে — সন্দেহজনক, backup বাতিল (কিছু মোছা হয়নি)");

  // শ্রিঙ্ক-গার্ড (শুধু auto): হঠাৎ বড় হ্রাস = সম্ভাব্য ভুল-মোছা/bug — এই backup 'সম্পূর্ণ' চিহ্নিত নয়, retention-ও চলে না (ভালো পুরনো কপি অক্ষত)।
  // বৈধ কারণে কমলে (যেমন ট্র্যাশ খালি) হাতে manual backup নিন — সেটাই নতুন baseline
  if (deps.type === "auto") {
    const shrink = findShrink(deps.prevCounts, counts);
    if (shrink.length > 0)
      throw new Error(
        `সন্দেহজনক হ্রাস (${shrink.map((s) => `${s.col}: ${s.prev}→${s.next}`).join(", ")}) — backup বাতিল, কিছু মোছা হয়নি। ইচ্ছাকৃত হলে manual backup নিন`,
      );
  }

  const completedAt = now();
  const w = await deps.writeDoc(folderName, {
    type: deps.type,
    format: "json",
    status: "complete",
    driveFolderId: folder.id,
    counts,
    completedAt,
    ownerUid: deps.ownerUid || derivedOwner || "unknown",
    createdAt: startedAt,
    updatedAt: completedAt,
  });
  log.info("backup সম্পূর্ণ", { folder: folderName, total, files, doc: w });

  // retention — backup আগেই সম্পূর্ণ; এখানকার ব্যর্থতা backup ব্যর্থ করে না
  let removed = 0;
  let retentionOk = true;
  try {
    const done = new Map((await deps.listCompleted()).map((d) => [d.driveFolderId, d.type]));
    done.set(folder.id, deps.type);
    const folders: DriveFolder[] = (await drive.listBackupFolders(BACKUP_FOLDER_PREFIX)).map(
      (f) => ({
        id: f.id,
        name: f.name,
        complete: done.has(f.id),
        type: done.get(f.id),
      }),
    );
    const { remove } = planRetention(folders, now());
    for (const f of remove) {
      if (f.id === folder.id) continue; // নতুনটা কখনো নয় (বাড়তি সুরক্ষা)
      try {
        await drive.deleteFolder(f.id);
        removed++;
      } catch (e) {
        retentionOk = false;
        log.warn("পুরনো ফোল্ডার মোছা যায়নি", {
          folder: f.name,
          err: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } catch (e) {
    retentionOk = false;
    log.warn("retention চালানো যায়নি", { err: e instanceof Error ? e.message : String(e) });
  }

  return { folderName, counts, total, files, removedFolders: removed, retentionOk };
}
