// পথ ক (owner-CSR): Firebase Web SDK + owner ID token; rules প্রযোজ্য (`shareLinks`: owner-only)। শুধু dashboard থেকে dynamic import।
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import { SHARE_SCHEMA_VERSION, parseShareLink, type CreateShareInput, type ShareLinkRepo, type ShareLinkWithId } from "@/data/shareLinkRepo";
import { hashShareToken } from "@/data/shareToken";
import { SHARE_TOKEN_RE, expiryFrom } from "@/lib/shareLink";

export function createShareLinkRepoClient(db: Firestore, ownerUid: string): ShareLinkRepo {
  const ref = (id: string) => doc(db, "shareLinks", id);

  async function get(id: string): Promise<ShareLinkWithId | null> {
    const snap = await getDoc(ref(id));
    return snap.exists() ? parseShareLink(id, snap.data()) : null;
  }

  return {
    async list() {
      const snap = await getDocs(query(collection(db, "shareLinks"), orderBy("createdAt", "desc"), limit(100)));
      const out: ShareLinkWithId[] = [];
      for (const d of snap.docs) {
        try {
          out.push(parseShareLink(d.id, d.data()));
        } catch {
          // একটা বিকৃত doc যেন পুরো তালিকা না ভাঙে
        }
      }
      return out;
    },

    async create(input: CreateShareInput) {
      if (!SHARE_TOKEN_RE.test(input.token)) throw new Error("token অবৈধ");
      const id = await hashShareToken(input.token);
      const existing = await get(id);
      if (existing) return existing;
      await setDoc(ref(id), {
        postId: input.postId,
        postTitle: input.postTitle.slice(0, 200),
        ownerUid,
        createdAt: serverTimestamp(),
        expiresAt: expiryFrom(Date.now(), input.days),
        schemaVersion: SHARE_SCHEMA_VERSION,
      });
      const made = await get(id);
      if (!made) throw new Error("শেয়ার-লিংক সংরক্ষণ যাচাই ব্যর্থ");
      return made;
    },

    async revoke(id) {
      const cur = await get(id);
      if (!cur || cur.revokedAt) return;
      await updateDoc(ref(id), { revokedAt: serverTimestamp() });
    },

    async remove(id) {
      await deleteDoc(ref(id));
    },
  };
}
