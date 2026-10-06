// পথ ক (owner-CSR): বিদ্যমান slug-lock (slug → postId) — import dry-run-এর সংঘাত-যাচাই ও ইমপোর্টের skip-যাচাইয়ের জন্য। শুধু read।
// `slugs` doc-id = slug; trashed/slugHistory-ও lock-এ থাকে, তাই সংঘাত-যাচাই সম্পূর্ণ।
import { collection, getDocs, type Firestore } from "firebase/firestore";

export async function readSlugOwners(db: Firestore): Promise<Map<string, string>> {
  const snap = await getDocs(collection(db, "slugs"));
  return new Map(snap.docs.map((d) => [d.id, String(d.data().postId ?? "")]));
}

export async function readExistingSlugs(db: Firestore): Promise<Set<string>> {
  return new Set((await readSlugOwners(db)).keys());
}
