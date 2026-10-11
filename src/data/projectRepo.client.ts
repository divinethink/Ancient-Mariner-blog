// পথ ক (owner-CSR): Firebase Web SDK + owner ID token; rules প্রযোজ্য (`writingProjects`/`chapters`: পাবলিক-read শুধু published+public; write owner-only)।
// শুধু dashboard থেকে dynamic import (public bundle-এ Firebase নয়)।
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import {
  ChapterBodySchema,
  ChapterNotFoundError,
  ChapterTitleSchema,
  IdSchema,
  parseChapter,
  parseChapterDraft,
  parseProject,
  ProjectDescSchema,
  ProjectHasChaptersError,
  ProjectNotFoundError,
  ProjectRuleError,
  ProjectTitleSchema,
  TargetWordsSchema,
  WordCountSchema,
  type ChapterDraft,
  type ChapterWithId,
  type CreateChapterInput,
  type CreateProjectInput,
  type ProjectRepo,
  type SaveChapterEditInput,
  type UpdateChapterInput,
  type UpdateProjectInput,
  type WritingProjectWithId,
} from "@/data/projectRepo";
import { ChapterStatus, ChapterVisibility, ProjectStatus, ProjectType, ProjectVisibility } from "@/lib/enums";
import { newId } from "@/lib/id";
import {
  CHAPTER_SCHEMA_VERSION,
  chapterSlugBase,
  MAX_CHAPTERS_PER_PROJECT,
  nextOrder,
  pickFreeSlug,
  planReorder,
  PROJECT_SCHEMA_VERSION,
  projectSlugBase,
  sortByOrder,
} from "@/lib/projects";

const PROJECTS = "writingProjects";
const CHAPTERS = "chapters";
const DRAFTS = "drafts"; // প্রকাশিত অধ্যায়ের সম্পাদনা (targetType='chapter'); doc-ID = chapterId

type RawChapter = { id: string; slug: string; order: number; status: string };

export function createProjectRepoClient(db: Firestore, ownerUid: string): ProjectRepo {
  const pRef = (id: string) => doc(db, PROJECTS, id);
  const cRef = (id: string) => doc(db, CHAPTERS, id);
  const dRef = (id: string) => doc(db, DRAFTS, id);

  async function getProject(id: string): Promise<WritingProjectWithId | null> {
    const snap = await getDoc(pRef(IdSchema.parse(id)));
    return snap.exists() ? parseProject(snap.id, snap.data()) : null;
  }
  async function getChapter(id: string): Promise<ChapterWithId | null> {
    const snap = await getDoc(cRef(IdSchema.parse(id)));
    return snap.exists() ? parseChapter(snap.id, snap.data()) : null;
  }
  async function getChapterDraft(id: string): Promise<ChapterDraft | null> {
    const snap = await getDoc(dRef(IdSchema.parse(id)));
    if (!snap.exists() || snap.data().targetType !== "chapter") return null; // অন্য ধরনের draft কখনো অধ্যায়ের নয়
    return parseChapterDraft(snap.data());
  }
  /** draft-এর title/body/wordCount — অধ্যায়ে মেশানোর ক্ষেত্র */
  const foldFields = (d: ChapterDraft) => ({ title: d.title, body: d.body, wordCount: d.wordCount });
  async function mustChapter(id: string): Promise<ChapterWithId> {
    const c = await getChapter(id);
    if (!c) throw new ChapterNotFoundError(id);
    return c;
  }

  /** একটা প্রজেক্টের সব অধ্যায় (ট্র্যাশ সহ) — কাঁচা ক্ষেত্র: বিকৃত doc-ও slug/order/সংখ্যায় গণ্য (সংঘাত/ক্রম নিরাপদ) */
  async function rawChapters(projectId: string): Promise<RawChapter[]> {
    const snap = await getDocs(query(collection(db, CHAPTERS), where("projectId", "==", projectId)));
    return snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        slug: typeof x.slug === "string" ? x.slug : "",
        order: typeof x.order === "number" ? x.order : 0,
        status: typeof x.status === "string" ? x.status : "",
      };
    });
  }

  async function listChapters(projectId: string, opts: { includeTrashed?: boolean } = {}): Promise<ChapterWithId[]> {
    const snap = await getDocs(
      query(collection(db, CHAPTERS), where("projectId", "==", IdSchema.parse(projectId)), orderBy("order")), // composite index: projectId + order
    );
    const out: ChapterWithId[] = [];
    for (const d of snap.docs) {
      try {
        const c = parseChapter(d.id, d.data());
        if (opts.includeTrashed || c.status !== "trashed") out.push(c);
      } catch {
        // একটা বিকৃত doc যেন পুরো তালিকা না ভাঙে
      }
    }
    return sortByOrder(out);
  }

  return {
    async listProjects() {
      const snap = await getDocs(query(collection(db, PROJECTS), orderBy("updatedAt", "desc"))); // single-field index (auto)
      const out: WritingProjectWithId[] = [];
      for (const d of snap.docs) {
        try {
          out.push(parseProject(d.id, d.data()));
        } catch {
          // বিকৃত doc বাদ
        }
      }
      return out;
    },
    getProject,

    async createProject(input: CreateProjectInput) {
      const id = IdSchema.parse(input.id ?? newId());
      const existing = await getProject(id); // retry/double-submit-এ duplicate নয়
      if (existing) return existing;
      const title = ProjectTitleSchema.parse(input.title);
      const taken = new Set((await getDocs(collection(db, PROJECTS))).docs.map((d) => String(d.data().slug ?? "")));
      const slug = pickFreeSlug(projectSlugBase(title, id), taken);
      if (!slug) throw new ProjectRuleError("slug বানানো গেল না — নাম বদলে দেখুন");
      await setDoc(pRef(id), {
        title,
        slug,
        type: ProjectType.parse(input.type),
        description: ProjectDescSchema.parse(input.description ?? ""),
        status: "draft",
        visibility: "private",
        ...(input.targetWords !== undefined ? { targetWords: TargetWordsSchema.parse(input.targetWords) } : {}),
        ownerUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        schemaVersion: PROJECT_SCHEMA_VERSION,
      });
      const created = await getProject(id);
      if (!created) throw new ProjectNotFoundError(id);
      return created;
    },

    async updateProject(id: string, patch: UpdateProjectInput) {
      const cur = await getProject(id);
      if (!cur) throw new ProjectNotFoundError(id);
      const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (patch.title !== undefined) data.title = ProjectTitleSchema.parse(patch.title);
      if (patch.type !== undefined) data.type = ProjectType.parse(patch.type);
      if (patch.description !== undefined) data.description = ProjectDescSchema.parse(patch.description);
      if (patch.visibility !== undefined) data.visibility = ProjectVisibility.parse(patch.visibility);
      if (patch.status !== undefined) {
        data.status = ProjectStatus.parse(patch.status);
        if (patch.status === "published" && !cur.publishedAt) data.publishedAt = serverTimestamp();
      }
      if (patch.targetWords === null) data.targetWords = deleteField();
      else if (patch.targetWords !== undefined) data.targetWords = TargetWordsSchema.parse(patch.targetWords);
      await updateDoc(pRef(id), data); // slug অপরিবর্তিত
      const next = await getProject(id);
      if (!next) throw new ProjectNotFoundError(id);
      return next;
    },

    async deleteProject(id: string) {
      const n = (await rawChapters(IdSchema.parse(id))).length; // ট্র্যাশ-করা সহ — আগে অধ্যায় সরাতে হবে
      if (n > 0) throw new ProjectHasChaptersError(n);
      await deleteDoc(pRef(id));
    },

    listChapters,
    getChapter,

    async createChapter(input: CreateChapterInput) {
      const id = IdSchema.parse(input.id ?? newId());
      const existing = await getChapter(id); // retry/double-submit-এ duplicate নয়
      if (existing) return existing;
      const projectId = IdSchema.parse(input.projectId);
      if (!(await getProject(projectId))) throw new ProjectNotFoundError(projectId);
      const title = ChapterTitleSchema.parse(input.title);
      const all = await rawChapters(projectId);
      if (all.length >= MAX_CHAPTERS_PER_PROJECT) throw new ProjectRuleError(`একটা প্রজেক্টে সর্বোচ্চ ${MAX_CHAPTERS_PER_PROJECT}টি অধ্যায়`);
      const slug = pickFreeSlug(chapterSlugBase(title, id), new Set(all.map((c) => c.slug)));
      if (!slug) throw new ProjectRuleError("slug বানানো গেল না — নাম বদলে দেখুন");
      await setDoc(cRef(id), {
        projectId,
        title,
        slug,
        body: ChapterBodySchema.parse(input.body ?? ""),
        wordCount: WordCountSchema.parse(input.wordCount ?? 0),
        order: nextOrder(all),
        status: "draft",
        visibility: "private",
        ownerUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        schemaVersion: CHAPTER_SCHEMA_VERSION,
      });
      return mustChapter(id);
    },

    async updateChapter(id: string, patch: UpdateChapterInput) {
      const cur = await mustChapter(id);
      if (cur.status === "trashed") throw new ProjectRuleError("ট্র্যাশের অধ্যায় সম্পাদনা নয় — আগে পুনরুদ্ধার করুন");
      const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (patch.title !== undefined) data.title = ChapterTitleSchema.parse(patch.title);
      if (patch.body !== undefined) data.body = ChapterBodySchema.parse(patch.body);
      if (patch.wordCount !== undefined) data.wordCount = WordCountSchema.parse(patch.wordCount);
      if (patch.visibility !== undefined) data.visibility = ChapterVisibility.parse(patch.visibility);
      if (patch.status !== undefined) {
        const st = ChapterStatus.parse(patch.status);
        if (st === "trashed") throw new ProjectRuleError("ট্র্যাশে পাঠাতে trashChapter ব্যবহার করুন");
        data.status = st;
        if (st === "published" && !cur.publishedAt) data.publishedAt = serverTimestamp();
      }
      // প্রকাশিত → draft: থাকা সম্পাদনা (drafts) আগে অধ্যায়ে মেশে, নইলে লুকিয়ে থাকত (patch-এর স্পষ্ট মান জেতে)
      const fold = cur.status === "published" && patch.status === "draft" ? await getChapterDraft(id) : null;
      if (fold) {
        const batch = writeBatch(db);
        batch.update(cRef(id), { ...foldFields(fold), ...data });
        batch.delete(dRef(id));
        await batch.commit();
      } else {
        await updateDoc(cRef(id), data); // slug/projectId/order অপরিবর্তিত
      }
      return mustChapter(id);
    },

    async reorderChapters(projectId: string, orderedIds: readonly string[]) {
      const pid = IdSchema.parse(projectId);
      const live = (await rawChapters(pid)).filter((c) => c.status !== "trashed");
      const plan = planReorder(live, orderedIds);
      if (!plan.ok) throw new ProjectRuleError("অধ্যায়ের তালিকা বদলে গেছে — রিফ্রেশ করুন");
      if (plan.patches.length > 0) {
        const batch = writeBatch(db); // ≤ MAX_CHAPTERS_PER_PROJECT লেখা — ৫০০-র সীমার ভেতরে
        for (const p of plan.patches) batch.update(cRef(p.id), { order: p.order, updatedAt: serverTimestamp() });
        await batch.commit();
      }
      return listChapters(pid);
    },

    async trashChapter(id: string) {
      const cur = await mustChapter(id);
      if (cur.status === "trashed") return cur;
      const fold = await getChapterDraft(id); // থাকা সম্পাদনা আগে অধ্যায়ে (পুনরুদ্ধারে হারায় না), এক batch
      const trashed = { status: "trashed", trashedAt: serverTimestamp(), updatedAt: serverTimestamp() };
      if (fold) {
        const batch = writeBatch(db);
        batch.update(cRef(id), { ...foldFields(fold), ...trashed });
        batch.delete(dRef(id));
        await batch.commit();
      } else {
        await updateDoc(cRef(id), trashed);
      }
      return mustChapter(id);
    },

    async restoreChapter(id: string) {
      const cur = await mustChapter(id);
      if (cur.status !== "trashed") return cur;
      await updateDoc(cRef(id), { status: "draft", trashedAt: deleteField(), updatedAt: serverTimestamp() });
      return mustChapter(id);
    },

    async deleteChapter(id: string) {
      const snap = await getDoc(cRef(IdSchema.parse(id)));
      if (!snap.exists()) return;
      if (snap.data().status !== "trashed") throw new ProjectRuleError("স্থায়ী মোছা শুধু ট্র্যাশের অধ্যায়");
      const batch = writeBatch(db);
      batch.delete(cRef(id));
      batch.delete(dRef(id)); // পড়ে-থাকা draft সাফ (না থাকলেও নিরাপদ); ইতিহাস-snapshot মোছে Cron (orphan)
      await batch.commit();
    },

    async saveChapterEdit(id: string, edit: SaveChapterEditInput) {
      const cur = await mustChapter(id);
      if (cur.status !== "published") throw new ProjectRuleError("সম্পাদনা-draft শুধু প্রকাশিত অধ্যায়ে");
      const updatedAt = new Date();
      const d = {
        targetType: "chapter" as const,
        title: ChapterTitleSchema.parse(edit.title),
        body: ChapterBodySchema.parse(edit.body),
        wordCount: WordCountSchema.parse(edit.wordCount),
        ownerUid,
        updatedAt,
        schemaVersion: CHAPTER_SCHEMA_VERSION,
      };
      await setDoc(dRef(id), d); // idempotent — doc-ID = chapterId
      return updatedAt;
    },
    getChapterDraft,

    async applyChapterDraft(id: string) {
      const cur = await mustChapter(id);
      if (cur.status === "trashed") throw new ProjectRuleError("ট্র্যাশের অধ্যায়ে প্রকাশ নয়");
      const d = await getChapterDraft(id);
      if (!d) return null;
      const batch = writeBatch(db);
      batch.update(cRef(id), { ...foldFields(d), updatedAt: serverTimestamp() });
      batch.delete(dRef(id));
      await batch.commit();
      return mustChapter(id);
    },
    discardChapterDraft: (id: string) => deleteDoc(dRef(IdSchema.parse(id))),
  };
}
