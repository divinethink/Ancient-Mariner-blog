// পথ ক (owner-CSR): `media` rules (public-read শুধু visibility=='public'; write owner)। শুধু dashboard থেকে dynamic import।
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
  startAfter,
  updateDoc,
  where,
  type Firestore,
  type QueryConstraint,
} from "firebase/firestore";
import {
  CreateMediaSchema,
  MEDIA_PAGE,
  MEDIA_SCHEMA_VERSION,
  MediaMetaPatchSchema,
  MediaNotFoundError,
  parseMedia,
  type CreateMediaInput,
  type MediaListOpts,
  type MediaMetaPatch,
  type MediaPage,
  type MediaRepo,
  type MediaWithId,
} from "@/data/mediaRepo";
import { newId } from "@/lib/id";

export function createMediaRepoClient(db: Firestore, ownerUid: string): MediaRepo {
  const ref = (id: string) => doc(db, "media", id);

  async function get(id: string): Promise<MediaWithId | null> {
    const snap = await getDoc(ref(id));
    return snap.exists() ? parseMedia(id, snap.data()) : null;
  }
  const must = async (id: string): Promise<MediaWithId> => {
    const v = await get(id);
    if (!v) throw new MediaNotFoundError(id);
    return v;
  };

  async function list(opts: MediaListOpts = {}): Promise<MediaPage> {
    const size = opts.limit ?? MEDIA_PAGE;
    // type-filter সহ: composite index media (type ASC, createdAt DESC) — firestore.indexes.json
    const c: QueryConstraint[] = [];
    if (opts.type) c.push(where("type", "==", opts.type));
    c.push(orderBy("createdAt", "desc"));
    if (opts.after) c.push(startAfter(opts.after));
    c.push(limit(size + 1)); // +১ = আরও আছে কিনা জানতে (অতিরিক্ত query নয়)
    const docs = (await getDocs(query(collection(db, "media"), ...c))).docs;
    const items: MediaWithId[] = [];
    for (const d of docs.slice(0, size)) {
      try {
        items.push(parseMedia(d.id, d.data()));
      } catch {
        // বিকৃত doc বাদ (তালিকা ভাঙে না)
      }
    }
    const more = docs.length > size;
    const last = more ? (docs[size - 1].data().createdAt as { toDate(): Date } | undefined)?.toDate?.() : undefined;
    return { items, next: more ? last : undefined };
  }

  async function create(input: CreateMediaInput): Promise<MediaWithId> {
    const v = CreateMediaSchema.parse(input);
    const id = v.id ?? newId();
    const existing = await get(id);
    if (existing) return existing;
    const { id: _omit, ...rest } = v;
    void _omit;
    await setDoc(ref(id), {
      ...Object.fromEntries(Object.entries(rest).filter(([, x]) => x !== undefined)),
      ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: MEDIA_SCHEMA_VERSION,
    });
    return must(id);
  }

  async function updateMeta(id: string, patch: MediaMetaPatch): Promise<MediaWithId> {
    const p = MediaMetaPatchSchema.parse(patch);
    const cur = await must(id);
    const changed = (Object.keys(p) as (keyof MediaMetaPatch)[]).filter((k) => p[k] !== undefined && p[k] !== cur[k]);
    if (changed.length === 0) return cur; // idempotent
    await updateDoc(ref(id), { ...Object.fromEntries(changed.map((k) => [k, p[k]])), updatedAt: serverTimestamp() });
    return must(id);
  }

  async function del(id: string): Promise<void> {
    await deleteDoc(ref(id));
  }

  return { list, get, create, updateMeta, delete: del };
}
