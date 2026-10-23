// পথ ক (owner-CSR): অসমাপ্ত খসড়া খোঁজা — আলাদা ছোট adapter (PostRepo-র interface অপরিবর্তিত)। শুধু dashboard থেকে dynamic import।
// query: status=='draft' && updatedAt <= (এখন−৩০ দিন), updatedAt desc — composite index (firestore.indexes.json); index তৈরির আগে/ব্যর্থ হলে কার্ড লুকানো থাকে।
import { Timestamp, collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { getOwnerDb } from "@/data/ownerDb";
import { parsePost, type PostWithId } from "@/data/postRepo";
import { STALE_LIST_MAX, staleCutoff } from "@/lib/staleDrafts";

export async function listStaleDrafts(now: number): Promise<PostWithId[]> {
  const { db } = await getOwnerDb();
  const q = query(
    collection(db, "posts"),
    where("status", "==", "draft"),
    where("updatedAt", "<=", Timestamp.fromMillis(staleCutoff(now))),
    orderBy("updatedAt", "desc"),
    limit(STALE_LIST_MAX),
  );
  const out: PostWithId[] = [];
  for (const d of (await getDocs(q)).docs) {
    try {
      out.push(parsePost(d.id, d.data()));
    } catch {
      // বিকৃত doc বাদ
    }
  }
  return out;
}
