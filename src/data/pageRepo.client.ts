// পথ ক (owner-CSR): Firebase Web SDK + owner ID token; rules প্রযোজ্য (pages: published পাবলিক-read; লেখা/মোছা শুধু owner; system মোছা নিষিদ্ধ)।
// শুধু dashboard থেকে dynamic import (public bundle-এ Firebase নয়)।
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import {
  PageBody,
  PageExistsError,
  PageNotFoundError,
  PageRuleError,
  PageTitle,
  parsePage,
  type CreatePageInput,
  type PageRepo,
  type PageWithId,
  type UpdatePageInput,
} from "@/data/pageRepo";
import { PageStatus } from "@/lib/enums";
import { checkPageSlug, isSystemSlug, PAGE_SCHEMA_VERSION, SYSTEM_PAGES } from "@/lib/pages";

const COL = "pages";

export function createPageRepoClient(db: Firestore, ownerUid: string): PageRepo {
  const ref = (slug: string) => doc(db, COL, slug);

  async function read(slug: string): Promise<PageWithId | null> {
    const s = await getDoc(ref(slug));
    return s.exists() ? parsePage(s.id, s.data()) : null;
  }

  return {
    async list() {
      const snap = await getDocs(collection(db, COL));
      return snap.docs
        .map((d) => parsePage(d.id, d.data()))
        .sort((a, b) => Number(b.system) - Number(a.system) || a.title.localeCompare(b.title, "bn"));
    },
    get: read,
    async create(input: CreatePageInput) {
      // system slug (about/privacy) seed-পথে আসে; হাতে বানাতে চাইলেও বৈধ — reserved নয়
      const bad = checkPageSlug(input.slug);
      if (bad !== "ok") throw new PageRuleError(`অবৈধ slug: ${bad}`);
      const data = {
        title: PageTitle.parse(input.title),
        body: PageBody.parse(input.body),
        status: PageStatus.parse(input.status),
        system: isSystemSlug(input.slug),
        ownerUid,
        schemaVersion: PAGE_SCHEMA_VERSION,
      };
      await runTransaction(db, async (tx) => {
        if ((await tx.get(ref(input.slug))).exists()) throw new PageExistsError(input.slug);
        tx.set(ref(input.slug), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      });
      const out = await read(input.slug);
      if (!out) throw new PageNotFoundError(input.slug);
      return out;
    },
    async update(slug: string, patch: UpdatePageInput) {
      const data: Record<string, unknown> = {};
      if (patch.title !== undefined) data.title = PageTitle.parse(patch.title);
      if (patch.body !== undefined) data.body = PageBody.parse(patch.body);
      if (patch.status !== undefined) data.status = PageStatus.parse(patch.status);
      try {
        await updateDoc(ref(slug), { ...data, updatedAt: serverTimestamp() });
      } catch (e) {
        if ((e as { code?: string }).code === "not-found") throw new PageNotFoundError(slug);
        throw e;
      }
      const out = await read(slug);
      if (!out) throw new PageNotFoundError(slug);
      return out;
    },
    async remove(slug: string) {
      const cur = await read(slug);
      if (!cur) return; // idempotent
      if (cur.system) throw new PageRuleError("সিস্টেম পেজ মোছা যায় না");
      await deleteDoc(ref(slug));
    },
    async ensureSystemPages() {
      let created = 0;
      for (const p of SYSTEM_PAGES) {
        await runTransaction(db, async (tx) => {
          if ((await tx.get(ref(p.slug))).exists()) return;
          tx.set(ref(p.slug), {
            title: p.title,
            body: p.body,
            status: "draft",
            system: true,
            ownerUid,
            schemaVersion: PAGE_SCHEMA_VERSION,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          created++;
        });
      }
      return created;
    },
  };
}
