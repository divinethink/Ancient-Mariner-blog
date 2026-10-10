// পথ ক (owner-CSR): খোঁজ-index-এর জন্য posts/ideas/notes পড়া। `updatedAt` single-field (auto index) — নতুন composite index নেই।
// শুধু dashboard থেকে dynamic import (public bundle-এ Firebase নয়)।
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { parseIdea } from "@/data/ideaRepo";
import { parseNote } from "@/data/noteRepo";
import { parsePost } from "@/data/postRepo";
import type { SearchSource } from "@/data/searchIndex";
import { ideaEntry, noteEntry, postEntry, type SearchEntry, type SearchKind } from "@/lib/search";

const COLLECTION: Record<SearchKind, string> = { post: "posts", idea: "ideas", note: "notes" };
const PAGE = 100;
const MAX_PAGES = 200; // নিরাপত্তা-সীমা (≈২০,০০০ doc)

function toEntry(kind: SearchKind, id: string, raw: DocumentData): SearchEntry {
  if (kind === "post") {
    const p = parsePost(id, raw);
    return postEntry({ ...p, id });
  }
  if (kind === "idea") {
    const i = parseIdea(id, raw);
    return ideaEntry({ id, title: i.title, text: i.text, type: i.type, updatedAt: i.updatedAt });
  }
  const n = parseNote(id, raw);
  return noteEntry({
    id,
    title: n.title,
    content: n.content,
    kind: n.kind,
    updatedAt: n.updatedAt,
  });
}

export function createSearchSource(db: Firestore): SearchSource {
  return {
    async fetch(kind, since) {
      const out: SearchEntry[] = [];
      let after: QueryDocumentSnapshot | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const cs: QueryConstraint[] = [];
        if (since !== null) cs.push(where("updatedAt", ">=", Timestamp.fromMillis(since)));
        cs.push(orderBy("updatedAt", "asc"));
        if (after) cs.push(startAfter(after));
        cs.push(limit(PAGE));
        const snap = await getDocs(query(collection(db, COLLECTION[kind]), ...cs));
        for (const d of snap.docs) {
          try {
            out.push(toEntry(kind, d.id, d.data()));
          } catch {
            // একটা বিকৃত doc যেন পুরো index না ভাঙে
          }
        }
        if (snap.docs.length < PAGE) return out;
        after = snap.docs[snap.docs.length - 1];
      }
      return out;
    },
    async exists(kind, id) {
      return (await getDoc(doc(db, COLLECTION[kind], id))).exists();
    },
  };
}
