// পথ ক (owner-CSR): Firebase Web SDK + owner ID token; rules প্রযোজ্য (categories/tags/series: public-read, owner-write)।
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
  where,
  type Firestore,
} from "firebase/firestore";
import {
  parseTerm,
  TAXONOMY_SCHEMA_VERSION,
  TermDescSchema,
  TermNameSchema,
  TermNotFoundError,
  TermRuleError,
  type CreateTermInput,
  type TaxonomyRepo,
  type TermWithId,
  type UpdateTermInput,
} from "@/data/taxonomyRepo";
import type { TaxonomyKind } from "@/lib/enums";
import { newId } from "@/lib/id";
import { withSuffix } from "@/lib/slug";
import { checkParent, termSlugBase } from "@/lib/taxonomy";

const MAX_SLUG_ATTEMPTS = 50;

export function createTaxonomyRepoClient(db: Firestore, ownerUid: string, kind: TaxonomyKind): TaxonomyRepo {
  const col = collection(db, kind);
  const ref = (id: string) => doc(db, kind, id);

  async function get(id: string): Promise<TermWithId | null> {
    const snap = await getDoc(ref(id));
    return snap.exists() ? parseTerm(id, snap.data()) : null;
  }

  async function list(): Promise<TermWithId[]> {
    const snap = await getDocs(query(col, orderBy("name")));
    const out: TermWithId[] = [];
    for (const d of snap.docs) {
      try {
        out.push(parseTerm(d.id, d.data()));
      } catch {
        // একটা বিকৃত doc যেন পুরো তালিকা না ভাঙে
      }
    }
    return out;
  }

  /** একই collection-এ slug খালি কিনা (single-owner — race-এর ঝুঁকি গ্রহণযোগ্য; সংঘাতে suffix) */
  async function freeSlug(base: string, selfId: string): Promise<string> {
    for (let n = 1; n <= MAX_SLUG_ATTEMPTS; n++) {
      const cand = withSuffix(base, n);
      const snap = await getDocs(query(col, where("slug", "==", cand), limit(1)));
      if (snap.empty || snap.docs[0].id === selfId) return cand;
    }
    throw new TermRuleError("slug বানানো গেল না — নাম বদলে দেখুন");
  }

  async function assertParent(selfId: string, parentId: string) {
    if (kind !== "categories") throw new TermRuleError("parent শুধু ক্যাটাগরিতে");
    const parent = await get(parentId);
    const kids = await getDocs(query(col, where("parentCategoryId", "==", selfId), limit(1)));
    const r = checkParent(selfId, parent, !kids.empty);
    if (!r.ok) throw new TermRuleError(r.reason);
  }

  async function create(input: CreateTermInput): Promise<TermWithId> {
    const id = input.id ?? newId();
    const existing = await get(id); // retry/double-submit-এ duplicate নয়
    if (existing) return existing;
    const name = TermNameSchema.parse(input.name);
    const description = TermDescSchema.parse(input.description ?? "");
    if (input.parentCategoryId) await assertParent(id, input.parentCategoryId);
    const slug = await freeSlug(termSlugBase(name, id), id);
    await setDoc(ref(id), {
      name,
      slug,
      description,
      ...(input.parentCategoryId ? { parentCategoryId: input.parentCategoryId } : {}),
      ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: TAXONOMY_SCHEMA_VERSION,
    });
    const created = await get(id);
    if (!created) throw new TermNotFoundError(id);
    return created;
  }

  async function update(id: string, patch: UpdateTermInput): Promise<TermWithId> {
    const cur = await get(id);
    if (!cur) throw new TermNotFoundError(id);
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.name !== undefined) data.name = TermNameSchema.parse(patch.name);
    if (patch.description !== undefined) data.description = TermDescSchema.parse(patch.description);
    if (patch.parentCategoryId === null) data.parentCategoryId = deleteField();
    else if (patch.parentCategoryId !== undefined) {
      await assertParent(id, patch.parentCategoryId);
      data.parentCategoryId = patch.parentCategoryId;
    }
    await updateDoc(ref(id), data); // slug অপরিবর্তিত (taxonomyRepo.ts-এর সিদ্ধান্ত)
    const next = await get(id);
    if (!next) throw new TermNotFoundError(id);
    return next;
  }

  async function del(id: string): Promise<void> {
    if (kind === "categories") {
      const kids = await getDocs(query(col, where("parentCategoryId", "==", id), limit(1)));
      if (!kids.empty) throw new TermRuleError("সন্তান ক্যাটাগরি আছে — আগে সরান");
    }
    await deleteDoc(ref(id));
  }

  return { kind, list, get, create, update, delete: del };
}
