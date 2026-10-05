// পথ ক (owner-CSR): Firebase Web SDK + owner ID token; rules প্রযোজ্য (`ideas`: owner-only)।
// শুধু dashboard থেকে dynamic import (public bundle-এ Firebase নয়)।
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import {
  IDEA_SCHEMA_VERSION,
  IdeaNotFoundError,
  IdeaTextSchema,
  IdeaTitleSchema,
  parseIdea,
  type CreateIdeaInput,
  type IdeaRepo,
  type IdeaWithId,
  type UpdateIdeaInput,
} from "@/data/ideaRepo";
import { IdeaType } from "@/lib/enums";
import { IDEAS_PAGE } from "@/lib/idea";
import { newId } from "@/lib/id";

export function createIdeaRepoClient(db: Firestore, ownerUid: string): IdeaRepo {
  const ref = (id: string) => doc(db, "ideas", id);

  async function get(id: string): Promise<IdeaWithId | null> {
    const snap = await getDoc(ref(id));
    return snap.exists() ? parseIdea(id, snap.data()) : null;
  }
  const must = async (id: string): Promise<IdeaWithId> => {
    const v = await get(id);
    if (!v) throw new IdeaNotFoundError(id);
    return v;
  };

  async function list(opts: { limit?: number } = {}): Promise<IdeaWithId[]> {
    // single-field index (auto)
    const snap = await getDocs(
      query(collection(db, "ideas"), orderBy("createdAt", "desc"), limit(opts.limit ?? IDEAS_PAGE)),
    );
    const out: IdeaWithId[] = [];
    for (const d of snap.docs) {
      try {
        out.push(parseIdea(d.id, d.data()));
      } catch {
        // একটা বিকৃত doc যেন পুরো তালিকা না ভাঙে
      }
    }
    return out;
  }

  async function create(input: CreateIdeaInput): Promise<IdeaWithId> {
    const id = input.id ?? newId();
    const existing = await get(id); // retry/double-submit-এ duplicate নয়
    if (existing) return existing;
    const text = IdeaTextSchema.parse(input.text);
    const title = input.title === undefined ? "" : IdeaTitleSchema.parse(input.title);
    await setDoc(ref(id), {
      text,
      ...(title ? { title } : {}),
      type: IdeaType.parse(input.type ?? "quick"),
      ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: IDEA_SCHEMA_VERSION,
    });
    return must(id);
  }

  async function update(id: string, patch: UpdateIdeaInput): Promise<IdeaWithId> {
    await must(id);
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.text !== undefined) data.text = IdeaTextSchema.parse(patch.text);
    if (patch.type !== undefined) data.type = IdeaType.parse(patch.type);
    if (patch.title === null) data.title = deleteField();
    else if (patch.title !== undefined) {
      const t = IdeaTitleSchema.parse(patch.title);
      data.title = t === "" ? deleteField() : t;
    }
    await updateDoc(ref(id), data);
    return must(id);
  }

  async function markConverted(id: string, postId: string): Promise<IdeaWithId> {
    const cur = await must(id);
    if (cur.convertedToPostId === postId) return cur; // idempotent
    await updateDoc(ref(id), { convertedToPostId: postId, updatedAt: serverTimestamp() });
    return must(id);
  }

  async function del(id: string): Promise<void> {
    await deleteDoc(ref(id));
  }

  return { get, list, create, update, markConverted, delete: del };
}
