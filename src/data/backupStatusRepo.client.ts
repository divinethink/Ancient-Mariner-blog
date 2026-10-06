// পথ ক (owner-CSR): `backups` শুধু পড়া। single-field order — আলাদা composite index লাগে না। শুধু dashboard থেকে dynamic import।
import { collection, getDocs, limit, orderBy, query, type Firestore } from "firebase/firestore";
import { parseBackupMeta, type BackupMetaWithId, type BackupStatusRepo } from "@/data/backupStatusRepo";

export function createBackupStatusRepoClient(db: Firestore): BackupStatusRepo {
  async function list(opts?: { limit?: number }): Promise<BackupMetaWithId[]> {
    const q = query(collection(db, "backups"), orderBy("completedAt", "desc"), limit(opts?.limit ?? 20));
    const out: BackupMetaWithId[] = [];
    for (const d of (await getDocs(q)).docs) {
      try {
        out.push(parseBackupMeta(d.id, d.data()));
      } catch {
        // বিকৃত doc বাদ
      }
    }
    return out;
  }
  return { list, latest: async () => (await list({ limit: 1 }))[0] ?? null };
}
