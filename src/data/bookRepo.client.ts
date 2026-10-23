// পথ ক (owner-CSR): `books` — owner write; শুধু dashboard থেকে dynamic import।
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import {
  BOOK_SCHEMA_VERSION,
  BookAuthorSchema,
  BookNoteSchema,
  BookNotFoundError,
  BookTitleSchema,
  parseBook,
  type BookPatch,
  type BookRepo,
  type BookWithId,
  type CreateBookInput,
} from "@/data/bookRepo";
import { BOOK_LIST_MAX, isDayKey } from "@/lib/books";
import { BookStatus, BookVisibility } from "@/lib/enums";
import { newId } from "@/lib/id";

export function createBookRepoClient(db: Firestore, ownerUid: string): BookRepo {
  const ref = (id: string) => doc(db, "books", id);

  async function get(id: string): Promise<BookWithId | null> {
    const snap = await getDoc(ref(id));
    return snap.exists() ? parseBook(id, snap.data()) : null;
  }
  const must = async (id: string): Promise<BookWithId> => {
    const v = await get(id);
    if (!v) throw new BookNotFoundError(id);
    return v;
  };
  const day = (s: string | undefined): string | undefined => (s !== undefined && isDayKey(s) ? s : undefined);

  async function list(): Promise<BookWithId[]> {
    // single-field order (auto index): composite লাগে না; অবস্থা-ছাঁকা client-এ
    const q = query(collection(db, "books"), orderBy("updatedAt", "desc"), limit(BOOK_LIST_MAX));
    const out: BookWithId[] = [];
    for (const d of (await getDocs(q)).docs) {
      try {
        out.push(parseBook(d.id, d.data()));
      } catch {
        // বিকৃত doc বাদ
      }
    }
    return out;
  }

  async function create(input: CreateBookInput): Promise<BookWithId> {
    const id = input.id ?? newId();
    const existing = await get(id);
    if (existing) return existing;
    const startDay = day(input.startDay);
    const endDay = day(input.endDay);
    await setDoc(ref(id), {
      title: BookTitleSchema.parse(input.title),
      author: input.author === undefined ? "" : BookAuthorSchema.parse(input.author),
      status: BookStatus.parse(input.status),
      visibility: "private",
      note: "",
      ...(startDay ? { startDay } : {}),
      ...(endDay ? { endDay } : {}),
      ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: BOOK_SCHEMA_VERSION,
    });
    return must(id);
  }

  async function update(id: string, patch: BookPatch): Promise<BookWithId> {
    await must(id);
    const startDay = day(patch.startDay);
    const endDay = day(patch.endDay);
    await updateDoc(ref(id), {
      ...(patch.title !== undefined ? { title: BookTitleSchema.parse(patch.title) } : {}),
      ...(patch.author !== undefined ? { author: BookAuthorSchema.parse(patch.author) } : {}),
      ...(patch.status !== undefined ? { status: BookStatus.parse(patch.status) } : {}),
      ...(patch.visibility !== undefined ? { visibility: BookVisibility.parse(patch.visibility) } : {}),
      ...(patch.note !== undefined ? { note: BookNoteSchema.parse(patch.note) } : {}),
      ...(startDay ? { startDay } : {}),
      ...(endDay ? { endDay } : {}),
      updatedAt: serverTimestamp(),
    });
    return must(id);
  }

  async function del(id: string): Promise<void> {
    await deleteDoc(ref(id));
  }

  return { list, create, update, delete: del };
}
