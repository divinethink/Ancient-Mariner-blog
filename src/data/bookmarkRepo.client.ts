// পথ ক (owner-CSR): Firebase Web SDK + owner ID token; rules প্রযোজ্য (`bookmarks`/`highlights`: owner-only)।
// শুধু dashboard থেকে dynamic import (public bundle-এ Firebase নয়)।
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
import {
  HighlightQuoteSchema,
  MARKS_PAGE,
  MARKS_SCHEMA_VERSION,
  MarkPostIdSchema,
  MarkTitleSchema,
  parseBookmark,
  parseHighlight,
  type BookmarkRepo,
} from "@/data/bookmarkRepo";

export function createBookmarkRepoClient(db: Firestore, ownerUid: string): BookmarkRepo {
  const bm = (id: string) => doc(db, "bookmarks", id);
  const hl = (id: string) => doc(db, "highlights", id);

  async function listAll<T>(name: string, n: number, parse: (id: string, raw: Record<string, unknown>) => T): Promise<T[]> {
    const snap = await getDocs(query(collection(db, name), orderBy("createdAt", "desc"), limit(n))); // single-field index (auto)
    const out: T[] = [];
    for (const d of snap.docs) {
      try {
        out.push(parse(d.id, d.data()));
      } catch {
        // একটা বিকৃত doc যেন পুরো তালিকা না ভাঙে
      }
    }
    return out;
  }

  return {
    async isBookmarked(postId) {
      return (await getDoc(bm(MarkPostIdSchema.parse(postId)))).exists();
    },
    async addBookmark(postId, postTitle) {
      const id = MarkPostIdSchema.parse(postId);
      if ((await getDoc(bm(id))).exists()) return; // double-tap/retry-তে বদল নেই
      await setDoc(bm(id), { postId: id, postTitle: MarkTitleSchema.parse(postTitle), ownerUid, createdAt: serverTimestamp(), schemaVersion: MARKS_SCHEMA_VERSION });
    },
    async removeBookmark(postId) {
      await deleteDoc(bm(MarkPostIdSchema.parse(postId)));
    },
    listBookmarks: (opts = {}) => listAll("bookmarks", opts.limit ?? MARKS_PAGE, parseBookmark).then((r) => r.map((b) => ({ ...b, id: b.postId }))),
    async addHighlight(input) {
      if ((await getDoc(hl(input.id))).exists()) return; // retry/double-submit-এ duplicate নয়
      await setDoc(hl(input.id), {
        postId: MarkPostIdSchema.parse(input.postId),
        postTitle: MarkTitleSchema.parse(input.postTitle),
        quote: HighlightQuoteSchema.parse(input.quote),
        ownerUid,
        createdAt: serverTimestamp(),
        schemaVersion: MARKS_SCHEMA_VERSION,
      });
    },
    listHighlights: (opts = {}) => listAll("highlights", opts.limit ?? MARKS_PAGE, parseHighlight),
    async deleteHighlight(id) {
      await deleteDoc(hl(id));
    },
  };
}
