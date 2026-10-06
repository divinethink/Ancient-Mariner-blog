// পথ ক (owner-CSR): `revisions` — rules-এ owner read/create, update/delete নিষিদ্ধ। শুধু dashboard থেকে dynamic import।
// নোট: দুই ট্যাবে একসাথে create-এ একই versionNumber দুটো doc-এ বসতে পারে (ক্ষতিহীন; ইতিহাস-তালিকায় দুটোই দেখা যায়)।
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import {
  REVISION_RETAIN,
  REVISION_SCHEMA_VERSION,
  SnapshotSchema,
  parseRevision,
  type CreateRevisionInput,
  type RevisionRepo,
  type RevisionWithId,
} from "@/data/revisionRepo";
import { RevisionTrigger } from "@/lib/enums";
import { isValidPostId, newId } from "@/lib/id";
import { nextVersionNumber } from "@/lib/revision";

export function createRevisionRepoClient(db: Firestore, ownerUid: string): RevisionRepo {
  const ref = (id: string) => doc(db, "revisions", id);

  async function get(id: string): Promise<RevisionWithId | null> {
    const snap = await getDoc(ref(id));
    return snap.exists() ? parseRevision(id, snap.data()) : null;
  }

  async function list(targetId: string, opts?: { limit?: number }): Promise<RevisionWithId[]> {
    // composite index: revisions (targetType ASC, targetId ASC, versionNumber DESC) — firestore.indexes.json
    const q = query(
      collection(db, "revisions"),
      where("targetType", "==", "post"),
      where("targetId", "==", targetId),
      orderBy("versionNumber", "desc"),
      limit(opts?.limit ?? REVISION_RETAIN),
    );
    const out: RevisionWithId[] = [];
    for (const d of (await getDocs(q)).docs) {
      try {
        out.push(parseRevision(d.id, d.data()));
      } catch {
        // বিকৃত doc বাদ
      }
    }
    return out;
  }

  async function create(input: CreateRevisionInput): Promise<RevisionWithId> {
    if (!isValidPostId(input.targetId)) throw new Error("অবৈধ লেখার id");
    const id = input.id ?? newId();
    const existing = await get(id);
    if (existing) return existing;
    const snapshot = SnapshotSchema.parse(input.snapshot);
    const trigger = RevisionTrigger.parse(input.trigger);
    const latest = (await list(input.targetId, { limit: 1 }))[0]?.versionNumber;
    await setDoc(ref(id), {
      targetType: "post",
      targetId: input.targetId,
      snapshot,
      versionNumber: nextVersionNumber(latest),
      trigger,
      ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: REVISION_SCHEMA_VERSION,
    });
    const made = await get(id);
    if (!made) throw new Error("ইতিহাস-snapshot সংরক্ষণ যাচাই ব্যর্থ");
    return made;
  }

  return { list, get, create };
}
