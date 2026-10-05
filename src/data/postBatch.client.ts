// পোস্ট-ফিল্ডের সংগঠন-সংক্রান্ত bulk আপডেট (rename-propagation, migration): chunked writeBatch, chunk-ভিত্তিক ব্যর্থতা গোনা।
// `updatedAt` ইচ্ছাকৃতভাবে ছোঁয়া হয় না (taxonomyOps.ts-এর সিদ্ধান্ত)। শুধু dashboard (পথ ক)।
import { doc, writeBatch, type Firestore } from "firebase/firestore";
import type { PropagateResult } from "@/data/taxonomyOps";
import { chunk } from "@/lib/taxonomy";

export type PostUpdate = { id: string; data: Record<string, unknown>; published: boolean };

export async function commitPostUpdates(db: Firestore, ups: readonly PostUpdate[]): Promise<PropagateResult> {
  let updated = 0;
  let publishedAffected = 0;
  let failed = 0;
  for (const part of chunk(ups)) {
    try {
      const b = writeBatch(db);
      for (const u of part) b.update(doc(db, "posts", u.id), u.data);
      await b.commit();
      updated += part.length;
      publishedAffected += part.filter((u) => u.published).length;
    } catch {
      failed += part.length; // বাকি chunk চলে; ব্যর্থ অংশ আবার চেষ্টায় (idempotent) ঠিক হয়
    }
  }
  return { updated, publishedAffected, failed };
}
