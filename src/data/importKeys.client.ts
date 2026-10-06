// পথ ক (owner-CSR): বিদ্যমান slug-lock-এর তালিকা — import dry-run-এর সংঘাত-যাচাইয়ের জন্য। শুধু read (rules: owner read)।
// `slugs` doc-id = slug; trashed/slugHistory-ও lock-এ থাকে, তাই সংঘাত-যাচাই সম্পূর্ণ।
import { collection, getDocs, type Firestore } from "firebase/firestore";

export async function readExistingSlugs(db: Firestore): Promise<Set<string>> {
  return new Set((await getDocs(collection(db, "slugs"))).docs.map((d) => d.id));
}
