// পথ ক (owner-CSR): Firebase Web SDK + owner ID token; rules প্রযোজ্য (`templates`: owner-only)।
// শুধু dashboard থেকে dynamic import (public bundle-এ Firebase নয়)।
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import {
  TEMPLATE_SCHEMA_VERSION,
  TemplateBodySchema,
  TemplateNameSchema,
  parseTemplate,
  type CreateTemplateInput,
  type TemplateRepo,
  type TemplateWithId,
} from "@/data/templateRepo";
import { newId } from "@/lib/id";
import { TEMPLATES_PAGE } from "@/lib/templates";

export function createTemplateRepoClient(db: Firestore, ownerUid: string): TemplateRepo {
  const ref = (id: string) => doc(db, "templates", id);

  async function get(id: string): Promise<TemplateWithId | null> {
    const snap = await getDoc(ref(id));
    return snap.exists() ? parseTemplate(id, snap.data()) : null;
  }

  async function list(opts: { limit?: number } = {}): Promise<TemplateWithId[]> {
    // single-field index (auto)
    const snap = await getDocs(
      query(
        collection(db, "templates"),
        orderBy("createdAt", "desc"),
        limit(opts.limit ?? TEMPLATES_PAGE),
      ),
    );
    const out: TemplateWithId[] = [];
    for (const d of snap.docs) {
      try {
        out.push(parseTemplate(d.id, d.data()));
      } catch {
        // একটা বিকৃত doc যেন পুরো তালিকা না ভাঙে
      }
    }
    return out;
  }

  async function create(input: CreateTemplateInput): Promise<TemplateWithId> {
    const id = input.id ?? newId();
    const existing = await get(id); // retry/double-submit-এ duplicate নয়
    if (existing) return existing;
    const name = TemplateNameSchema.parse(input.name);
    const body = TemplateBodySchema.parse(input.body);
    await setDoc(ref(id), {
      name,
      body,
      ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: TEMPLATE_SCHEMA_VERSION,
    });
    const made = await get(id);
    if (!made) throw new Error("ছাঁচ সংরক্ষণ যাচাই ব্যর্থ");
    return made;
  }

  async function del(id: string): Promise<void> {
    await deleteDoc(ref(id));
  }

  return { get, list, create, delete: del };
}
