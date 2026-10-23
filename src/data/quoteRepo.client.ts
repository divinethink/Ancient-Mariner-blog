// পথ ক (owner-CSR): `quotes` owner-only rules। শুধু dashboard থেকে dynamic import।
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
import {
  QUOTE_SCHEMA_VERSION,
  QuoteNotFoundError,
  QuotePageSchema,
  QuoteTextSchema,
  parseQuote,
  type CreateQuoteInput,
  type QuoteRepo,
  type QuoteWithId,
} from "@/data/quoteRepo";
import { QUOTE_LIST_MAX } from "@/lib/books";
import { newId } from "@/lib/id";

export function createQuoteRepoClient(db: Firestore, ownerUid: string): QuoteRepo {
  const ref = (id: string) => doc(db, "quotes", id);

  async function get(id: string): Promise<QuoteWithId | null> {
    const snap = await getDoc(ref(id));
    return snap.exists() ? parseQuote(id, snap.data()) : null;
  }

  async function list(): Promise<QuoteWithId[]> {
    const q = query(collection(db, "quotes"), orderBy("createdAt", "desc"), limit(QUOTE_LIST_MAX));
    const out: QuoteWithId[] = [];
    for (const d of (await getDocs(q)).docs) {
      try {
        out.push(parseQuote(d.id, d.data()));
      } catch {
        // বিকৃত doc বাদ
      }
    }
    return out;
  }

  async function create(input: CreateQuoteInput): Promise<QuoteWithId> {
    const id = input.id ?? newId();
    const existing = await get(id);
    if (existing) return existing;
    const page = input.page === undefined ? "" : QuotePageSchema.parse(input.page);
    await setDoc(ref(id), {
      text: QuoteTextSchema.parse(input.text),
      ...(input.bookId ? { bookId: input.bookId } : {}),
      ...(input.bookTitle ? { bookTitle: input.bookTitle } : {}),
      ...(page ? { page } : {}),
      ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: QUOTE_SCHEMA_VERSION,
    });
    const v = await get(id);
    if (!v) throw new QuoteNotFoundError(id);
    return v;
  }

  async function del(id: string): Promise<void> {
    await deleteDoc(ref(id));
  }

  return { list, create, delete: del };
}
