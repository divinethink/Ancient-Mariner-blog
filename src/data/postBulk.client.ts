// Library Bulk actions-এর Firestore adapter (পথ ক; Checklist P3b-ক): তাজা পড়া + chunked writeBatch।
// pure পরিকল্পনা `lib/bulk.ts`-এ; এখানে শুধু লেখা। কোনো নতুন field/collection নেই — পুরনো data অক্ষত।
// সিদ্ধান্ত: chunk = ২০০ লেখা (প্রতিটায় সর্বোচ্চ ২ op: post-update + drafts-মোছা ⇒ ≤৪০০ < Firestore-সীমা ৫০০)।
// published থেকে বেরোনো লেখার থাকা `drafts` আগে posts-এ কপি হয়ে মোছে (Arch §১২; repo.trash-এর মতোই)।
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { parseDraft, parsePost, PostPatchSchema, type PostWithId } from "@/data/postRepo";
import type { BulkUpdate } from "@/lib/bulk";
import { countWords, docToText, parseBody } from "@/lib/editorDoc";
import { chunk } from "@/lib/taxonomy";

export const BULK_CHUNK = 200;
const READ_PARALLEL = 10;

export type CommitResult = {
  updatedIds: string[];
  failedIds: string[];
  /** সফল update-গুলোর মধ্যে পাবলিক সাইটে প্রভাব ফেলে এমন — >০ হলে একবার rebuild */
  affectsPublic: number;
};
export type BulkAdapter = {
  /** তাজা পড়া (stale তালিকা-ডেটার ওপর নির্ভর নয়); না-পাওয়া/বিকৃত doc বাদ */
  loadPosts(ids: readonly string[]): Promise<PostWithId[]>;
  /** সিরিজের বর্তমান সর্বোচ্চ পর্ব-নম্বর (`excludeIds` বাদে); কিছু না থাকলে ০। সীমাহীন query — হিসাব truncate হয় না */
  maxSeriesOrder(seriesId: string, excludeIds: ReadonlySet<string>): Promise<number>;
  commit(
    ups: readonly BulkUpdate[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<CommitResult>;
};

export function createBulkAdapterClient(db: Firestore): BulkAdapter {
  const postRef = (id: string) => doc(db, "posts", id);
  const draftRef = (id: string) => doc(db, "drafts", id);

  async function loadPosts(ids: readonly string[]): Promise<PostWithId[]> {
    const out: PostWithId[] = [];
    for (const part of chunk(ids, READ_PARALLEL)) {
      const snaps = await Promise.all(part.map((id) => getDoc(postRef(id))));
      snaps.forEach((s, i) => {
        if (!s.exists()) return;
        try {
          out.push(parsePost(part[i], s.data()));
        } catch {
          // বিকৃত doc বাদ — 'missing' হিসেবে গণ্য
        }
      });
    }
    return out;
  }

  async function maxSeriesOrder(
    seriesId: string,
    excludeIds: ReadonlySet<string>,
  ): Promise<number> {
    const snap = await getDocs(query(collection(db, "posts"), where("seriesId", "==", seriesId)));
    let max = 0;
    for (const d of snap.docs) {
      const n = d.data().seriesOrder;
      if (!excludeIds.has(d.id) && typeof n === "number" && n > max) max = n;
    }
    return max;
  }

  async function commit(
    ups: readonly BulkUpdate[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<CommitResult> {
    const updatedIds: string[] = [];
    const failedIds: string[] = [];
    let affectsPublic = 0;
    let done = 0;
    for (const part of chunk(ups, BULK_CHUNK)) {
      const batch = writeBatch(db);
      const inBatch: BulkUpdate[] = [];
      try {
        const drafts = await Promise.all(
          part.map((u) => (u.leavesPublished ? getDoc(draftRef(u.id)) : null)),
        );
        part.forEach((u, i) => {
          try {
            const patch = PostPatchSchema.parse(u.patch);
            const data: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(patch)) {
              if (v !== undefined) data[k] = v === null ? deleteField() : v; // null = ফিল্ড সরানো
            }
            if (u.trashedAt !== undefined)
              data.trashedAt = u.trashedAt === null ? deleteField() : u.trashedAt;
            if (u.touch) data.updatedAt = new Date();
            const snap = drafts[i];
            if (snap?.exists()) {
              const d = parseDraft(snap.data());
              Object.assign(data, {
                title: d.title,
                body: d.body,
                excerpt: d.excerpt,
                wordCount: countWords(docToText(parseBody(d.body))),
              });
              batch.delete(draftRef(u.id));
            }
            batch.update(postRef(u.id), data);
            inBatch.push(u);
          } catch {
            failedIds.push(u.id); // একটা বিকৃত patch/draft যেন পুরো chunk না আটকায়
          }
        });
        if (inBatch.length > 0) await batch.commit();
        for (const u of inBatch) {
          updatedIds.push(u.id);
          if (u.affectsPublic) affectsPublic++;
        }
      } catch {
        // পড়া/commit ব্যর্থ ⇒ chunk-এর বাকি সবাই ব্যর্থ (atomic batch; আংশিক লেখা নেই)
        const already = new Set(failedIds);
        for (const u of part) if (!already.has(u.id)) failedIds.push(u.id);
      }
      done += part.length;
      onProgress?.(done, ups.length);
    }
    return { updatedIds, failedIds, affectsPublic };
  }

  return { loadPosts, maxSeriesOrder, commit };
}
