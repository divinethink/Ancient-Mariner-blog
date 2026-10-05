// Migration 001 (P3a): ক্যাটাগরিহীন পোস্টে ডিফল্ট ক্যাটাগরি বসানো (Arch §১৭ P3a)।
// Additive + idempotent: শুধু `categoryId`/`categoryName` যোগ, কিছু মোছা/বদলানো নয়; trashed বাদ (restore-পরে প্রকাশে বসে)।
// dry-run কিছু লেখে না। চালানোর আগে ম্যানুয়াল JSON export (Dev Rules §৩)। কোনো run-tracking doc নেই — idempotent বলে আবার চালানো নিরাপদ।
import { collection, getDocs, type Firestore } from "firebase/firestore";
import { commitPostUpdates, type PostUpdate } from "@/data/postBatch.client";
import type { BackfillResult } from "@/data/taxonomyOps";

export async function backfillDefaultCategory(
  db: Firestore,
  ensureDefault: () => Promise<{ id: string; name: string }>,
  opts: { dryRun: boolean },
): Promise<BackfillResult> {
  // aggregation-জাতীয় — limit নেই (ফল truncate হলে ভুল); একবারের কাজ
  const snap = await getDocs(collection(db, "posts"));
  const missing = snap.docs.filter((d) => d.data().status !== "trashed" && !d.data().categoryId);
  if (opts.dryRun || missing.length === 0) {
    return { missing: missing.length, updated: 0, publishedAffected: 0, failed: 0 };
  }
  const def = await ensureDefault();
  const ups: PostUpdate[] = missing.map((d) => ({
    id: d.id,
    data: { categoryId: def.id, categoryName: def.name },
    published: d.data().status === "published" && d.data().visibility === "public",
  }));
  return { missing: missing.length, ...(await commitPostUpdates(db, ups)) };
}
