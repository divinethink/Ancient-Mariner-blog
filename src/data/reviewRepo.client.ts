// পথ ক (owner-CSR): সাপ্তাহিক পর্যালোচনার জন্য — সময়-সীমায় সম্পাদিত লেখা। আলাদা ছোট adapter (PostRepo-র interface অপরিবর্তিত)।
// query: updatedAt >= from && updatedAt < to, updatedAt desc — একই field-এর range+order ⇒ auto index, composite লাগে না। সর্বোচ্চ ২০০।
import { Timestamp, collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { getOwnerDb } from "@/data/ownerDb";
import { parsePost, type PostWithId } from "@/data/postRepo";

export const REVIEW_POST_MAX = 200;

export async function listPostsUpdatedBetween(fromMs: number, toMs: number): Promise<PostWithId[]> {
  const { db } = await getOwnerDb();
  const q = query(
    collection(db, "posts"),
    where("updatedAt", ">=", Timestamp.fromMillis(fromMs)),
    where("updatedAt", "<", Timestamp.fromMillis(toMs)),
    orderBy("updatedAt", "desc"),
    limit(REVIEW_POST_MAX),
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
