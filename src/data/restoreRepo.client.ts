// পথ ক (owner-CSR, rules প্রযোজ্য): JSON-restore-এর Firestore adapter (P5b-৩)। কখনো মোছে না। শুধু dashboard থেকে dynamic import।
import {
  collection,
  doc,
  documentId,
  getDocs,
  query,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { decodeBackupValue, type RestoreTarget } from "@/lib/restore";

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

export function createRestoreTargetClient(db: Firestore): RestoreTarget {
  return {
    async existingIds(col, ids) {
      if (ids.length === 0) return new Set();
      const snap = await getDocs(query(collection(db, col), where(documentId(), "in", [...ids])));
      return new Set(snap.docs.map((d) => d.id));
    },
    async write(col, entries) {
      const b = writeBatch(db);
      for (const e of entries)
        b.set(doc(db, col, e.id), decodeBackupValue(e.data, ts) as Record<string, unknown>);
      await b.commit();
    },
  };
}
