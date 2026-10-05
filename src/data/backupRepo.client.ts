// পথ ক (owner-CSR): ব্যাকআপের read-only উৎস। শুধু dashboard থেকে dynamic import; কিছু লেখে/মোছে না (rules: owner read)।
import {
  collection,
  documentId,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type Firestore,
} from "firebase/firestore";
import type { BackupSource } from "@/lib/backup";

export function createBackupSourceClient(db: Firestore): BackupSource {
  return {
    async count(col) {
      return (await getCountFromServer(collection(db, col))).data().count;
    },
    async readPage(col, afterId, size) {
      const base = [collection(db, col), orderBy(documentId())] as const;
      const q = afterId === undefined ? query(...base, limit(size)) : query(...base, startAfter(afterId), limit(size));
      return (await getDocs(q)).docs.map((d) => ({ id: d.id, data: d.data() }));
    },
  };
}
