// পথ ক (owner-CSR): `notes` owner-only rules। শুধু dashboard থেকে dynamic import।
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import {
  NOTE_SCHEMA_VERSION,
  NoteContentSchema,
  NoteNotFoundError,
  NoteTitleSchema,
  parseNote,
  type CreateNoteInput,
  type NoteRepo,
  type NoteWithId,
} from "@/data/noteRepo";
import { NoteKind } from "@/lib/enums";
import { IDEAS_PAGE } from "@/lib/idea";
import { newId } from "@/lib/id";

export function createNoteRepoClient(db: Firestore, ownerUid: string): NoteRepo {
  const ref = (id: string) => doc(db, "notes", id);

  async function get(id: string): Promise<NoteWithId | null> {
    const snap = await getDoc(ref(id));
    return snap.exists() ? parseNote(id, snap.data()) : null;
  }
  const must = async (id: string): Promise<NoteWithId> => {
    const v = await get(id);
    if (!v) throw new NoteNotFoundError(id);
    return v;
  };

  async function list(opts: { organized: boolean; limit?: number }): Promise<NoteWithId[]> {
    // composite index: notes (organized ASC, createdAt DESC) — firestore.indexes.json
    const q = query(
      collection(db, "notes"),
      where("organized", "==", opts.organized),
      orderBy("createdAt", "desc"),
      limit(opts.limit ?? IDEAS_PAGE),
    );
    const out: NoteWithId[] = [];
    for (const d of (await getDocs(q)).docs) {
      try {
        out.push(parseNote(d.id, d.data()));
      } catch {
        // বিকৃত doc বাদ
      }
    }
    return out;
  }

  async function create(input: CreateNoteInput): Promise<NoteWithId> {
    const id = input.id ?? newId();
    const existing = await get(id);
    if (existing) return existing;
    const content = NoteContentSchema.parse(input.content);
    const title = input.title === undefined ? "" : NoteTitleSchema.parse(input.title);
    await setDoc(ref(id), {
      content,
      ...(title ? { title } : {}),
      kind: NoteKind.parse(input.kind ?? "note"),
      organized: false,
      ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: NOTE_SCHEMA_VERSION,
    });
    return must(id);
  }

  async function setOrganized(id: string, organized: boolean): Promise<NoteWithId> {
    const cur = await must(id);
    if (cur.organized === organized) return cur;
    await updateDoc(ref(id), { organized, updatedAt: serverTimestamp() });
    return must(id);
  }

  async function del(id: string): Promise<void> {
    await deleteDoc(ref(id));
  }

  async function countInbox(): Promise<number> {
    return (
      await getCountFromServer(query(collection(db, "notes"), where("organized", "==", false)))
    ).data().count;
  }

  return { list, create, setOrganized, delete: del, countInbox };
}
