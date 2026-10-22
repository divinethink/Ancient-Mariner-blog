// পথ ক (owner-CSR): `letters` owner-only rules। শুধু dashboard থেকে dynamic import।
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
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
  LETTER_SCHEMA_VERSION,
  LetterBodySchema,
  LetterDateError,
  LetterNotFoundError,
  LetterTitleSchema,
  parseLetter,
  type CreateLetterInput,
  type LetterRepo,
  type LetterWithId,
} from "@/data/letterRepo";
import { newId } from "@/lib/id";
import { LETTER_LIST_MAX } from "@/lib/letters";

const READY_LIMIT = 10;

export function createLetterRepoClient(db: Firestore, ownerUid: string): LetterRepo {
  const ref = (id: string) => doc(db, "letters", id);

  async function get(id: string): Promise<LetterWithId | null> {
    const snap = await getDoc(ref(id));
    return snap.exists() ? parseLetter(id, snap.data()) : null;
  }
  const must = async (id: string): Promise<LetterWithId> => {
    const v = await get(id);
    if (!v) throw new LetterNotFoundError(id);
    return v;
  };
  const parseAll = (docs: { id: string; data: () => Record<string, unknown> }[]): LetterWithId[] => {
    const out: LetterWithId[] = [];
    for (const d of docs) {
      try {
        out.push(parseLetter(d.id, d.data()));
      } catch {
        // বিকৃত doc বাদ
      }
    }
    return out;
  };

  async function list(): Promise<LetterWithId[]> {
    // single-field order (auto index): composite লাগে না
    const q = query(collection(db, "letters"), orderBy("openAt", "asc"), limit(LETTER_LIST_MAX));
    return parseAll((await getDocs(q)).docs);
  }

  async function listReady(now: number): Promise<LetterWithId[]> {
    const q = query(collection(db, "letters"), where("openAt", "<=", Timestamp.fromMillis(now)), orderBy("openAt", "desc"), limit(READY_LIMIT));
    return parseAll((await getDocs(q)).docs).filter((l) => !l.openedAt);
  }

  async function create(input: CreateLetterInput): Promise<LetterWithId> {
    const id = input.id ?? newId();
    const existing = await get(id);
    if (existing) return existing;
    const body = LetterBodySchema.parse(input.body);
    const title = input.title === undefined ? "" : LetterTitleSchema.parse(input.title);
    if (input.openAt.getTime() <= Date.now()) throw new LetterDateError();
    await setDoc(ref(id), {
      title,
      body,
      openAt: Timestamp.fromDate(input.openAt),
      ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: LETTER_SCHEMA_VERSION,
    });
    return must(id);
  }

  async function markOpened(id: string): Promise<LetterWithId> {
    const cur = await must(id);
    if (cur.openedAt) return cur;
    await updateDoc(ref(id), { openedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return must(id);
  }

  async function del(id: string): Promise<void> {
    await deleteDoc(ref(id));
  }

  return { list, listReady, create, markOpened, delete: del };
}
