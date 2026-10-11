// projectRepo = interface + Zod boundary (Arch §২ 'Repo গঠন'); adapter: projectRepo.client.ts (পথ ক, owner-CSR)।
// `writingProjects` (উপন্যাস/গল্প/নাটক) ও `chapters` (অধ্যায়; `projectId` + `order`) — P14a-১, শুধু data layer (UI নেই)।
// পাবলিক-REST পড়া (পথ খ) P14c-তে `/works` আসার সময়; rules-এ পাবলিক-read শর্ত এখনই (অধ্যায় + তার প্রজেক্ট, দুটোই published+public)।
// সিদ্ধান্ত: slug তৈরির পর অপরিবর্তিত (পাবলিক URL স্থির); প্রজেক্ট-slug প্রজেক্টদের মধ্যে অনন্য, অধ্যায়-slug ওই প্রজেক্টের ভেতরে অনন্য।
// জানা খরচ: অধ্যায়-তালিকা পড়লে প্রতি doc-এর `body`-সহ আসে (SDK-তে field-select নেই) — তাই MAX_CHAPTERS_PER_PROJECT সীমা;
// ভবিষ্যতে দরকার হলে body আলাদা doc-এ নেওয়া যাবে (additive, schemaVersion +১)।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import { ChapterStatus, ChapterVisibility, ProjectStatus, ProjectType, ProjectVisibility } from "@/lib/enums";
import {
  CHAPTER_SCHEMA_VERSION,
  CHAPTER_TITLE_MAX,
  PROJECT_DESC_MAX,
  PROJECT_SCHEMA_VERSION,
  PROJECT_TITLE_MAX,
} from "@/lib/projects";

const MAX_BODY_BYTES = 900 * 1024; // UTF-8 byte — posts/pages-এর সাথে একই সীমা (Arch §৬)
const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

export const ProjectTitleSchema = z.string().trim().min(1).max(PROJECT_TITLE_MAX);
export const ProjectDescSchema = z.string().trim().max(PROJECT_DESC_MAX);
export const TargetWordsSchema = z.number().int().min(0).max(10_000_000);
export const ChapterTitleSchema = z.string().trim().min(1).max(CHAPTER_TITLE_MAX);
export const ChapterBodySchema = z.string().refine((s) => utf8Bytes(s) <= MAX_BODY_BYTES, "body সীমা ছাড়িয়েছে");
export const WordCountSchema = z.number().int().min(0).max(10_000_000);
export const IdSchema = z.string().regex(/^[A-Za-z0-9]{1,40}$/);

/** পড়ার সময় defensive (পুরনো/বিকৃত doc যেন তালিকা না ভাঙে) */
export const WritingProjectSchema = z.object({
  title: ProjectTitleSchema,
  slug: z.string().min(1),
  type: ProjectType,
  description: z.string().default(""),
  status: ProjectStatus,
  visibility: ProjectVisibility,
  /** লক্ষ্য-শব্দসংখ্যা (progress-এর হর); না থাকলে progress-% নেই */
  targetWords: TargetWordsSchema.optional(),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  publishedAt: z.date().optional(),
  schemaVersion: z.number().int().default(PROJECT_SCHEMA_VERSION),
});
export type WritingProject = z.infer<typeof WritingProjectSchema>;
export type WritingProjectWithId = WritingProject & { id: string };

export const ChapterSchema = z.object({
  projectId: z.string().min(1),
  title: ChapterTitleSchema,
  slug: z.string().min(1),
  body: z.string().default(""),
  wordCount: z.number().int().min(0).default(0),
  /** প্রজেক্টের ভেতরে ক্রম (ছোট আগে); ফাঁক থাকতে পারে */
  order: z.number().int().min(0),
  status: ChapterStatus,
  visibility: ChapterVisibility,
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  publishedAt: z.date().optional(),
  trashedAt: z.date().optional(),
  schemaVersion: z.number().int().default(CHAPTER_SCHEMA_VERSION),
});
export type Chapter = z.infer<typeof ChapterSchema>;
export type ChapterWithId = Chapter & { id: string };

/** প্রকাশিত অধ্যায়ের অপ্রকাশিত সম্পাদনা (`drafts/{chapterId}`, `targetType='chapter'`; P14a-৩) — পাবলিক-read কখনো নেই */
export const ChapterDraftSchema = z.object({
  targetType: z.literal("chapter").default("chapter"),
  title: ChapterTitleSchema,
  body: ChapterBodySchema,
  wordCount: z.number().int().min(0).default(0),
  ownerUid: z.string().min(1),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(CHAPTER_SCHEMA_VERSION),
});
export type ChapterDraft = z.infer<typeof ChapterDraftSchema>;
export const parseChapterDraft = (raw: Record<string, unknown>): ChapterDraft => ChapterDraftSchema.parse(normalizeRaw(raw));

export const parseProject = (id: string, raw: Record<string, unknown>): WritingProjectWithId => ({
  ...WritingProjectSchema.parse(normalizeRaw(raw)),
  id,
});
export const parseChapter = (id: string, raw: Record<string, unknown>): ChapterWithId => ({
  ...ChapterSchema.parse(normalizeRaw(raw)),
  id,
});

export type CreateProjectInput = {
  /** retry/double-submit-নিরাপত্তা: UI আগে id বানায়; একই id-তে দ্বিতীয় create = বিদ্যমান ফেরত */
  id?: string;
  title: string;
  type: ProjectType;
  description?: string;
  targetWords?: number;
};
export type UpdateProjectInput = {
  title?: string;
  type?: ProjectType;
  description?: string;
  status?: ProjectStatus;
  visibility?: ProjectVisibility;
  /** `null` = লক্ষ্য সরানো; অনুপস্থিত = অপরিবর্তিত */
  targetWords?: number | null;
};

export type CreateChapterInput = {
  /** retry-নিরাপত্তা: একই id-তে দ্বিতীয় create = বিদ্যমান ফেরত */
  id?: string;
  projectId: string;
  title: string;
  body?: string;
  wordCount?: number;
};
export type UpdateChapterInput = {
  title?: string;
  body?: string;
  wordCount?: number;
  status?: Exclude<ChapterStatus, "trashed">;
  visibility?: ChapterVisibility;
};

export type SaveChapterEditInput = { title: string; body: string; wordCount: number };

export class ProjectNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`প্রজেক্ট পাওয়া যায়নি: ${id}`);
    this.name = "ProjectNotFoundError";
  }
}
export class ChapterNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`অধ্যায় পাওয়া যায়নি: ${id}`);
    this.name = "ChapterNotFoundError";
  }
}
export class ProjectRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectRuleError";
  }
}
/** অধ্যায়-সহ প্রজেক্ট মোছা যায় না (ট্র্যাশ-করা সহ) — `count` UI-তে দেখানো হয় (ক্যাটাগরির delete-guard-এর মতো) */
export class ProjectHasChaptersError extends ProjectRuleError {
  constructor(public readonly count: number) {
    super(`${count}টি অধ্যায় আছে — আগে সরান`);
    this.name = "ProjectHasChaptersError";
  }
}

/** পথ ক (owner-CSR) */
export interface ProjectRepo {
  /** সব প্রজেক্ট, সাম্প্রতিক-সম্পাদিত আগে; সংখ্যা ছোট — limit নেই */
  listProjects(): Promise<WritingProjectWithId[]>;
  getProject(id: string): Promise<WritingProjectWithId | null>;
  /** idempotent (id আগে বানানো); নতুন প্রজেক্ট `draft`+`private`; slug প্রজেক্টদের মধ্যে অনন্য (সংঘাতে -২, -৩…) */
  createProject(input: CreateProjectInput): Promise<WritingProjectWithId>;
  /** slug অপরিবর্তিত; প্রথম `published`-এ `publishedAt` বসে */
  updateProject(id: string, patch: UpdateProjectInput): Promise<WritingProjectWithId>;
  /** যেকোনো অধ্যায় (ট্র্যাশ সহ) থাকলে ProjectHasChaptersError; না থাকলেও সফল */
  deleteProject(id: string): Promise<void>;

  /** `order` ক্রমে; `includeTrashed` default false */
  listChapters(projectId: string, opts?: { includeTrashed?: boolean }): Promise<ChapterWithId[]>;
  getChapter(id: string): Promise<ChapterWithId | null>;
  /** idempotent; নতুন অধ্যায় `draft`+`private`, order = সর্বোচ্চ+১; slug ওই প্রজেক্টের ভেতরে অনন্য; সীমা MAX_CHAPTERS_PER_PROJECT */
  createChapter(input: CreateChapterInput): Promise<ChapterWithId>;
  /** slug/projectId/order অপরিবর্তিত; প্রথম `published`-এ `publishedAt`; ট্র্যাশ-করা অধ্যায়ে ProjectRuleError (আগে পুনরুদ্ধার); `published → draft`-এ থাকা `drafts` আগে অধ্যায়ে মেশে (এক batch) */
  updateChapter(id: string, patch: UpdateChapterInput): Promise<ChapterWithId>;
  /**
   * ক্রম বসানো = `orderedIds` (ট্র্যাশ বাদে বর্তমান সব অধ্যায়ের permutation) — একটা writeBatch, শুধু বদলানো order লেখা।
   * idempotent; তালিকা ইতোমধ্যে বদলে গেলে ProjectRuleError (UI রিফ্রেশ করবে)। ফেরত: আপডেট-হওয়া তালিকা।
   */
  reorderChapters(projectId: string, orderedIds: readonly string[]): Promise<ChapterWithId[]>;
  /** `status='trashed'` + `trashedAt`; থাকা `drafts` আগে অধ্যায়ে মেশে (এক batch — লুকানো সম্পাদনা হারায় না); Cron-purge নেই (স্থায়ী মোছা শুধু হাতে); আগে থেকে ট্র্যাশ হলে বদল নেই */
  trashChapter(id: string): Promise<ChapterWithId>;
  /** `draft` হিসেবে ফেরে (স্বয়ংক্রিয় republish নয়); ট্র্যাশে না থাকলে বদল নেই */
  restoreChapter(id: string): Promise<ChapterWithId>;
  /** শুধু ট্র্যাশ-করা অধ্যায় (rules-ও আটকায়); না থাকলেও সফল; পড়ে-থাকা `drafts` একই batch-এ মোছে */
  deleteChapter(id: string): Promise<void>;

  /** (P14a-৩) প্রকাশিত অধ্যায়ের সম্পাদনা: `drafts/{id}` (idempotent set; পাবলিক অপরিবর্তিত)। অধ্যায় `published` না হলে ProjectRuleError। ফেরত: `updatedAt` */
  saveChapterEdit(id: string, edit: SaveChapterEditInput): Promise<Date>;
  getChapterDraft(id: string): Promise<ChapterDraft | null>;
  /** drafts → chapters কপি + drafts মোছা (এক batch); draft না থাকলে null, নইলে হালনাগাদ অধ্যায় */
  applyChapterDraft(id: string): Promise<ChapterWithId | null>;
  discardChapterDraft(id: string): Promise<void>;
}
