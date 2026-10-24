// Drive auto-backup (P5b-২): GitHub Actions `backup.yml` থেকে চলে (Node, tsx) — Worker-এ নয় (CPU সীমা)।
// Firestore শুধু পড়া + এক নতুন `backups` doc; Drive-এ তারিখ-ফোল্ডার লেখা; শেষে retention। ব্যর্থ হলে exit 1 (workflow লাল, owner-এর ৩ দিনের সতর্কতাও ধরে)।
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getBackupJobEnv } from "../src/config/env";
import { createBackupDocWriter } from "../src/data/privileged/backupDoc";
import { runBackupJob } from "../src/data/privileged/backupJob";
import { createDriveClient } from "../src/data/privileged/driveClient";
import { createAdminDb, createBudget } from "../src/data/privileged/firestoreAdmin";
import { createCollectionReader } from "../src/data/privileged/firestoreList";
import { createTokenProvider, parseServiceAccount } from "../src/data/privileged/googleAuth";
import { createLogger } from "../src/lib/logger";

async function main() {
  const env = getBackupJobEnv();
  const log = createLogger();
  const getToken = createTokenProvider({
    serviceAccount: parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT),
  });
  const db = createAdminDb({
    projectId: env.FIREBASE_PROJECT_ID,
    getToken,
    budget: createBudget(1_000_000),
  });
  const writer = createBackupDocWriter({ projectId: env.FIREBASE_PROJECT_ID, getToken });
  const drive = createDriveClient({
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    refreshToken: env.GOOGLE_OAUTH_REFRESH_TOKEN,
  });

  // আগের সবচেয়ে সাম্প্রতিক সম্পূর্ণ backup-এর counts (শ্রিঙ্ক-গার্ডের জন্য)
  const prev = await db.runQuery({
    from: [{ collectionId: "backups" }],
    select: { fields: [{ fieldPath: "completedAt" }, { fieldPath: "counts" }] },
    limit: 400,
  });
  const latest = prev.docs
    .filter(
      (d) =>
        d.data.completedAt instanceof Date &&
        typeof d.data.counts === "object" &&
        d.data.counts !== null,
    )
    .sort(
      (a, b) => (b.data.completedAt as Date).getTime() - (a.data.completedAt as Date).getTime(),
    )[0];
  const prevCounts = latest ? (latest.data.counts as Record<string, number>) : undefined;
  if (env.BACKUP_LOCAL_DIR) await mkdir(env.BACKUP_LOCAL_DIR, { recursive: true });

  const r = await runBackupJob({
    readPage: createCollectionReader({ projectId: env.FIREBASE_PROJECT_ID, getToken }),
    drive,
    writeDoc: (id, meta) => writer.create(id, meta),
    listCompleted: async () => {
      const { docs } = await db.runQuery({
        from: [{ collectionId: "backups" }],
        select: { fields: [{ fieldPath: "driveFolderId" }, { fieldPath: "type" }] },
        limit: 400,
      });
      return docs
        .filter((d) => typeof d.data.driveFolderId === "string")
        .map((d) => ({
          driveFolderId: d.data.driveFolderId as string,
          type: d.data.type === "manual" ? ("manual" as const) : ("auto" as const),
        }));
    },
    type: env.BACKUP_TYPE,
    prevCounts,
    onFile: env.BACKUP_LOCAL_DIR
      ? (name, content) => writeFile(join(env.BACKUP_LOCAL_DIR!, name), content, "utf8")
      : undefined,
    ownerUid: env.OWNER_UID || undefined,
    log,
  });
  console.log(
    `✅ backup সম্পূর্ণ: ${r.folderName} · ${r.total}টি doc · ${r.files}টি ফাইল · মোছা পুরনো ফোল্ডার ${r.removedFolders}`,
  );
  if (!r.retentionOk)
    console.log(
      "::warning::পুরনো backup-ফোল্ডার পরিষ্কার সম্পূর্ণ হয়নি (নতুন backup অক্ষত) — লগ দেখুন",
    );
}

main().catch((e) => {
  console.error("❌ backup ব্যর্থ:", e instanceof Error ? e.message : "অজানা ত্রুটি");
  process.exit(1);
});
