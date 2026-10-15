// পথ ক (owner-CSR): posts + taxonomy-কে ছোঁয়া ক্রিয়া (rules প্রযোজ্য)। শুধু dashboard থেকে dynamic import।
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import { backfillDefaultCategory } from "@/data/migrations/001-default-category.client";
import { commitPostUpdates, type PostUpdate } from "@/data/postBatch.client";
import { TermInUseError, TermNotFoundError, TermRuleError } from "@/data/taxonomyRepo";
import { createTaxonomyRepoClient } from "@/data/taxonomyRepo.client";
import {
  DEFAULT_CATEGORY_ID,
  DEFAULT_CATEGORY_NAME,
  type PropagateResult,
  type TaxonomyOps,
  type TermPost,
} from "@/data/taxonomyOps";
import type { TaxonomyKind } from "@/lib/enums";
import { SETTINGS_DOC_ID, SETTINGS_SCHEMA_VERSION } from "@/lib/siteSettings";
import { renamedTagNames } from "@/lib/taxonomy";

const NONE: PropagateResult = { updated: 0, publishedAffected: 0, failed: 0 };
const isPublic = (d: DocumentData) => d.status === "published" && d.visibility === "public";

export function createTaxonomyOpsClient(db: Firestore, ownerUid: string): TaxonomyOps {
  const posts = collection(db, "posts");
  const settingsRef = doc(db, "siteSettings", SETTINGS_DOC_ID);
  const repo = (k: TaxonomyKind) => createTaxonomyRepoClient(db, ownerUid, k);

  async function getDefaultCategoryId(): Promise<string | null> {
    const snap = await getDoc(settingsRef);
    const v = snap.exists() ? snap.data().defaultCategoryId : undefined;
    return typeof v === "string" && v ? v : null;
  }

  async function ensureDefaultCategory(): Promise<{ id: string; name: string }> {
    const curId = await getDefaultCategoryId();
    if (curId) {
      const t = await repo("categories").get(curId);
      if (t) return { id: t.id, name: t.name };
    }
    // স্থির doc-ID ⇒ retry/double-call-এ duplicate নয় (create বিদ্যমান ফেরত দেয়)
    const t = await repo("categories").create({ id: DEFAULT_CATEGORY_ID, name: DEFAULT_CATEGORY_NAME });
    await writeDefaultId(t.id);
    return { id: t.id, name: t.name };
  }

  /** siteSettings-এ শুধু `defaultCategoryId` merge — অন্য ফিল্ড অক্ষত; `createdAt` শুধু প্রথম লেখায় */
  async function writeDefaultId(id: string): Promise<void> {
    await runTransaction(db, async (tx) => {
      const exists = (await tx.get(settingsRef)).exists();
      tx.set(
        settingsRef,
        {
          defaultCategoryId: id,
          ownerUid,
          schemaVersion: SETTINGS_SCHEMA_VERSION,
          updatedAt: serverTimestamp(),
          ...(exists ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true },
      );
    });
  }

  async function setDefaultCategory(id: string): Promise<void> {
    if (!(await repo("categories").get(id))) throw new TermNotFoundError(id);
    await writeDefaultId(id);
  }

  const usageQuery = (kind: TaxonomyKind, id: string) =>
    query(
      posts,
      kind === "categories"
        ? where("categoryId", "==", id)
        : kind === "tags"
          ? where("tagIds", "array-contains", id)
          : where("seriesId", "==", id),
    );

  async function usage(kind: TaxonomyKind, id: string): Promise<number> {
    return (await getCountFromServer(usageQuery(kind, id))).data().count;
  }

  async function propagateName(kind: TaxonomyKind, id: string): Promise<PropagateResult> {
    if (kind === "series") return NONE; // পোস্টে series-এর নাম কপি নেই (শুধু seriesId)
    const term = await repo(kind).get(id);
    if (!term) throw new TermNotFoundError(id);
    const snap = await getDocs(usageQuery(kind, id)); // সব (trashed-সহ) — limit নেই
    const ups: PostUpdate[] = [];
    for (const d of snap.docs) {
      const data = d.data();
      if (kind === "categories") {
        if (data.categoryName !== term.name) {
          ups.push({ id: d.id, data: { categoryName: term.name }, published: isPublic(data) });
        }
      } else {
        const next = renamedTagNames(data.tagIds ?? [], data.tagNames ?? [], id, term.name);
        if (next) ups.push({ id: d.id, data: { tagNames: next }, published: isPublic(data) });
      }
    }
    return commitPostUpdates(db, ups);
  }

  async function rename(kind: TaxonomyKind, id: string, name: string): Promise<PropagateResult> {
    await repo(kind).update(id, { name });
    return propagateName(kind, id);
  }

  async function listPosts(kind: TaxonomyKind, id: string): Promise<TermPost[]> {
    const snap = await getDocs(usageQuery(kind, id)); // single-field query (auto index); trashed-সহ (সংখ্যার সাথে মেলে); updatedAt-ক্রম কোডে
    return snap.docs
      .map((d) => {
        const x = d.data();
        const t = x.updatedAt && typeof x.updatedAt.toMillis === "function" ? (x.updatedAt.toMillis() as number) : 0;
        return { id: d.id, title: typeof x.title === "string" ? x.title : "", status: String(x.status ?? ""), published: isPublic(x), t };
      })
      .sort((a, b) => b.t - a.t)
      .map(({ id: pid, title, status, published }) => ({ id: pid, title, status, published }));
  }

  async function moveToCategory(list: readonly TermPost[], categoryId: string): Promise<PropagateResult> {
    const term = await repo("categories").get(categoryId);
    if (!term) throw new TermNotFoundError(categoryId);
    const ups: PostUpdate[] = list.map((p) => ({
      id: p.id,
      data: { categoryId: term.id, categoryName: term.name },
      published: p.published,
    }));
    return commitPostUpdates(db, ups);
  }

  async function remove(kind: TaxonomyKind, id: string): Promise<void> {
    if (kind === "categories" && (id === DEFAULT_CATEGORY_ID || id === (await getDefaultCategoryId()))) {
      throw new TermRuleError("ডিফল্ট ক্যাটাগরি মোছা যায় না");
    }
    const n = await usage(kind, id);
    if (n > 0) throw new TermInUseError(n);
    await repo(kind).delete(id); // categories: সন্তান থাকলে TermRuleError
  }

  return {
    getDefaultCategoryId,
    ensureDefaultCategory,
    setDefaultCategory,
    usage,
    rename,
    propagateName,
    listPosts,
    moveToCategory,
    remove,
    backfillDefaultCategory: (opts) => backfillDefaultCategory(db, ensureDefaultCategory, opts),
  };
}
