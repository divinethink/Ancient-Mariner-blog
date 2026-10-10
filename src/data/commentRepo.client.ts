// পথ ক (owner-CSR): Firebase Web SDK + owner ID token; rules প্রযোজ্য (`comments`: owner সব read; write নেই)। শুধু dashboard থেকে dynamic import।
import { collection, getDocs, limit, orderBy, query, type Firestore } from "firebase/firestore";
import { parseComment, type CommentRepo, type CommentWithId } from "@/data/commentRepo";

export function createCommentRepoClient(db: Firestore): CommentRepo {
  return {
    async list() {
      const snap = await getDocs(query(collection(db, "comments"), orderBy("createdAt", "desc"), limit(200)));
      const out: CommentWithId[] = [];
      for (const d of snap.docs) {
        try {
          out.push(parseComment(d.id, d.data()));
        } catch {
          // একটা বিকৃত doc যেন পুরো তালিকা না ভাঙে
        }
      }
      return out;
    },
  };
}
