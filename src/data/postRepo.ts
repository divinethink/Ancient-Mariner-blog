// postRepo = interface + Zod boundary (Arch §২ 'Repo গঠন'); adapter: postRepo.client.ts (পথ ক), postRepo.server.ts (পথ খ)
// Zod শুধু shell field validate করে; `body` (Tiptap JSON string)-র কাঠামো renderer/editor-এ (Arch §২)।
import { z } from "zod";
import { ContentType, PostStatus, PostVisibility } from "@/lib/enums";
import { isValidDayKey } from "@/lib/diary";
import { DIARY_THEMES } from "@/lib/diaryLook";
import { COVER_FOCUS, COVER_RATIOS, toCoverCrop } from "@/lib/coverCrop";
import type { FindOpts } from "@/lib/postFind";

export const SCHEMA_VERSION = 1;
const MAX_BODY_BYTES = 900 * 1024; // UTF-8 byte (বাংলা ≈ ৩ byte/অক্ষর) — Arch §৬
const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;
const Body = z.string().refine((s) => utf8Bytes(s) <= MAX_BODY_BYTES, "body সীমা ছাড়িয়েছে");

/** Firestore Timestamp / ISO-string / Date → Date (importSource-এর nested তারিখ; `normalizeRaw` শুধু top-level বদলায়) */
const AnyDate = z.preprocess((v) => {
  if (v && typeof v === "object" && typeof (v as { toDate?: unknown }).toDate === "function") return (v as { toDate(): Date }).toDate();
  return typeof v === "string" ? new Date(v) : v;
}, z.date());

/** P3c-খ: ইমপোর্ট-উৎস (additive, optional) — `{site, wpPostId}` = পুনরায় ইমপোর্টে skip-এর চাবি; মূল তারিখ/লিংক/ক্যাটাগরি-ট্যাগ অক্ষত */
export const ImportSourceSchema = z.object({
  site: z.string().min(1),
  wpPostId: z.string().min(1),
  originalDate: AnyDate.optional(),
  originalUrl: z.string().optional(),
  sourceStatus: z.string().optional(),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});
export type ImportSource = z.infer<typeof ImportSourceSchema>;

/** P8a: diary/travel-এর দিন ("YYYY-MM-DD", সাইট-timezone), স্থান (পাবলিকে কখনো নয়), gallery (media-id) */
export const MAX_LOCATION = 120;
export const MAX_GALLERY = 20; // lib/gallery.MAX_GALLERY_ITEMS-এর সমান
const DayKey = z.string().refine(isValidDayKey, "তারিখ YYYY-MM-DD নয়");
const Location = z.string().max(MAX_LOCATION);
const Gallery = z.array(z.string().min(1).max(40)).max(MAX_GALLERY);

/** P10a-১: per-post SEO (Arch §৬ `seo{}`); সব ফিল্ড ঐচ্ছিক, খালি = ডিফল্ট (শিরোনাম/সারাংশ/cover) */
export const MAX_SEO_TITLE = 120;
export const MAX_SEO_DESC = 300;
/** কভারের পাবলিক-ক্রপ (শুধু CSS; মূল ছবি অক্ষত); না থাকা = পুরো ছবি */
export const CoverCropSchema = z.object({ ratio: z.enum(COVER_RATIOS), focus: z.enum(COVER_FOCUS) });

export const SeoSchema = z.object({
  title: z.string().max(MAX_SEO_TITLE).optional(),
  description: z.string().max(MAX_SEO_DESC).optional(),
  ogImageId: z.string().min(1).max(40).optional(),
  noindex: z.boolean().optional(),
});
export type Seo = z.infer<typeof SeoSchema>;

export const PostSchema = z.object({
  title: z.string(),
  slug: z.string().min(1),
  slugHistory: z.array(z.string()).default([]),
  contentType: ContentType.default("post"),
  body: Body,
  excerpt: z.string().default(""),
  status: PostStatus,
  visibility: PostVisibility,
  wordCount: z.number().int().nonnegative().default(0),
  // P3a: সংগঠন (Arch §৬) — পুরনো doc-এ নেই, তাই optional/default (defensive read)
  categoryId: z.string().min(1).optional(),
  categoryName: z.string().optional(),
  tagIds: z.array(z.string()).default([]),
  tagNames: z.array(z.string()).default([]),
  seriesId: z.string().min(1).optional(),
  seriesOrder: z.number().int().nonnegative().optional(),
  importSource: ImportSourceSchema.optional(), // P3c-খ; বিকৃত হলে `parsePost` বাদ দেয়
  featured: z.boolean().optional(), // P4b-৩: Home-এ featured (পুরনো doc-এ নেই = false)
  commentsEnabled: z.boolean().optional(), // P11b-২: নতুন মন্তব্য নেওয়া হবে কি (পুরনো doc-এ নেই = চালু; Arch §৬)
  coverMediaId: z.string().min(1).max(40).optional(), // P6-৩ক: cover = `media/{id}` (পাবলিক ছবি); পুরনো doc-এ নেই = cover নেই
  coverCrop: CoverCropSchema.optional(), // কভার-ক্রপ (অনুপাত+ফোকাস); পুরনো doc-এ নেই = পুরো ছবি
  date: DayKey.optional(), // P8a: diary-র দিন; পুরনো doc-এ নেই
  location: Location.optional(), // P8a: owner-লেখা স্থান; প্রকাশিত লেখার meta-তে দেখায় (media-র নিজস্ব location/GPS নয়, সেটা কখনো পাবলিকে না)
  gallery: Gallery.optional(), // P8a: media-id তালিকা (P8a-২-তে পাবলিক gallery)
  diaryTheme: z.enum(DIARY_THEMES).optional(), // দিনলিপি পাবলিক করার সময়কার থিম; পুরনো doc-এ নেই = সাইটের থিম; অজানা/সরানো থিম `parsePost` বাদ দেয়
  seo: SeoSchema.optional(), // P10a-১: per-post SEO; পুরনো doc-এ নেই; বিকৃত হলে `parsePost` বাদ দেয়
  publishedAt: z.date().optional(),
  scheduledAt: z.date().optional(), // P11c-১: status=scheduled-এ প্রকাশের সময় (UTC); publish হলে সরে যায়
  trashedAt: z.date().optional(),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(SCHEMA_VERSION),
});

export type Post = z.infer<typeof PostSchema>;
export type PostWithId = Post & { id: string };

/** আংশিক সম্পাদনা — `.partial()` নয় (Zod 4-এ default ঢুকে পড়ত); স্পষ্ট optional */
export const MAX_TAGS_PER_POST = 20;
export const PostPatchSchema = z
  .object({
    title: z.string().optional(),
    body: Body.optional(),
    excerpt: z.string().optional(),
    wordCount: z.number().int().nonnegative().optional(),
    status: PostStatus.optional(),
    visibility: PostVisibility.optional(),
    publishedAt: z.date().optional(),
    scheduledAt: z.date().nullable().optional(), // null = সময়সূচি সরানো
    contentType: ContentType.optional(),
    // `null` = ফিল্ড সরানো (client adapter deleteField করে); অনুপস্থিত = অপরিবর্তিত
    categoryId: z.string().min(1).nullable().optional(),
    categoryName: z.string().nullable().optional(),
    tagIds: z.array(z.string().min(1)).max(MAX_TAGS_PER_POST).optional(),
    tagNames: z.array(z.string()).max(MAX_TAGS_PER_POST).optional(),
    seriesId: z.string().min(1).nullable().optional(),
    seriesOrder: z.number().int().nonnegative().nullable().optional(),
    featured: z.boolean().optional(),
    commentsEnabled: z.boolean().optional(),
    coverMediaId: z.string().min(1).max(40).nullable().optional(), // null = cover সরানো
    coverCrop: CoverCropSchema.nullable().optional(), // null = ক্রপ সরানো (পুরো ছবি)
    date: DayKey.nullable().optional(),
    location: Location.nullable().optional(),
    gallery: Gallery.nullable().optional(),
    diaryTheme: z.enum(DIARY_THEMES).nullable().optional(), // null = সাইটের থিমে ফেরা
    seo: SeoSchema.nullable().optional(), // null = SEO-সেটিং সরানো (পুরো map)
  })
  .refine((p) => (p.tagIds === undefined) === (p.tagNames === undefined), "tagIds ও tagNames একসাথে দিতে হবে")
  .refine((p) => p.tagIds === undefined || p.tagIds.length === p.tagNames?.length, "tagIds/tagNames দৈর্ঘ্য অমিল")
  .refine((p) => (p.categoryId === undefined) === (p.categoryName === undefined), "categoryId ও categoryName একসাথে দিতে হবে");
export type PostPatch = z.infer<typeof PostPatchSchema>;

/** প্রকাশিত লেখার অপ্রকাশিত সম্পাদনা (Arch §৬ `drafts`, doc-ID = postId) */
export const DraftSchema = z.object({
  targetType: z.literal("post").default("post"),
  title: z.string(),
  body: Body,
  excerpt: z.string().default(""),
  ownerUid: z.string().min(1),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(SCHEMA_VERSION),
});
export type Draft = z.infer<typeof DraftSchema>;

/** পাবলিক card/list-এর payload — `body` নেই (Arch §২ Public payload) */
// category/tag/series জোড়া থাকে (P3a-৩; P4a-র card/filter-এর জন্য) — সবই denormalized নাম/id, `body` নয়
export type PostCard = Pick<
  PostWithId,
  | "id"
  | "title"
  | "slug"
  | "excerpt"
  | "publishedAt"
  | "wordCount"
  | "contentType"
  | "categoryId"
  | "categoryName"
  | "tagIds"
  | "tagNames"
  | "seriesId"
  | "seriesOrder"
>;
export const toPostCard = (p: PostWithId): PostCard => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  excerpt: p.excerpt,
  publishedAt: p.publishedAt,
  wordCount: p.wordCount,
  contentType: p.contentType,
  categoryId: p.categoryId,
  categoryName: p.categoryName,
  tagIds: p.tagIds,
  tagNames: p.tagNames,
  seriesId: p.seriesId,
  seriesOrder: p.seriesOrder,
});

const DATE_KEYS = new Set(["publishedAt", "scheduledAt", "trashedAt", "createdAt", "updatedAt"]);

/** Firestore Timestamp / REST ISO-string → Date; null বাদ — তারপর Zod (defensive read, Dev Rules §৩) */
export function normalizeRaw(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "object" && typeof (v as { toDate?: unknown }).toDate === "function") {
      out[k] = (v as { toDate(): Date }).toDate();
    } else if (DATE_KEYS.has(k) && typeof v === "string") {
      out[k] = new Date(v);
    } else out[k] = v;
  }
  return out;
}

export const parsePost = (id: string, raw: Record<string, unknown>): PostWithId => {
  const n = normalizeRaw(raw);
  // বিকৃত importSource পুরো লেখা ভাঙে না — শুধু বাদ (defensive read, Dev Rules §৩)
  if (n.importSource !== undefined && !ImportSourceSchema.safeParse(n.importSource).success) delete n.importSource;
  if (n.featured !== undefined && typeof n.featured !== "boolean") delete n.featured; // বিকৃত featured শুধু বাদ
  // P8a: বিকৃত date/location/gallery পুরো লেখা ভাঙে না — শুধু ওই ফিল্ড বাদ
  if (n.date !== undefined && !DayKey.safeParse(n.date).success) delete n.date;
  if (n.location !== undefined && !Location.safeParse(n.location).success) delete n.location;
  if (n.gallery !== undefined && !Gallery.safeParse(n.gallery).success) delete n.gallery;
  if (n.diaryTheme !== undefined && !(DIARY_THEMES as readonly unknown[]).includes(n.diaryTheme)) delete n.diaryTheme; // ভবিষ্যতে সরানো থিমে লেখা ভাঙে না
  if (n.coverCrop !== undefined && !toCoverCrop(n.coverCrop)) delete n.coverCrop; // বিকৃত ক্রপ শুধু বাদ
  if (n.seo !== undefined && !SeoSchema.safeParse(n.seo).success) delete n.seo; // P10a-১: বিকৃত seo শুধু বাদ
  return { ...PostSchema.parse(n), id };
};
export const parseDraft = (raw: Record<string, unknown>): Draft =>
  DraftSchema.parse(normalizeRaw(raw));

export class SlugTakenError extends Error {
  constructor(public readonly slug: string) {
    super(`slug ব্যবহৃত: ${slug}`);
    this.name = "SlugTakenError";
  }
}
export class PostNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`লেখা পাওয়া যায়নি: ${id}`);
    this.name = "PostNotFoundError";
  }
}

export class TrashRequiredError extends Error {
  constructor(public readonly id: string) {
    super(`আগে ট্র্যাশে পাঠাতে হবে: ${id}`);
    this.name = "TrashRequiredError";
  }
}

export type CreatePostInput = {
  /** retry-নিরাপত্তার জন্য editor আগে থেকে id বানিয়ে রাখে; একই id-তে দ্বিতীয় create = বিদ্যমান ফেরত */
  id?: string;
  title: string;
  body: string;
  excerpt?: string;
  wordCount?: number;
  visibility?: PostVisibility;
  /** P8a: Quick Diary Entry — contentType=diary ও দিন ("YYYY-MM-DD"); না দিলে আগের মতো `post` */
  contentType?: ContentType;
  date?: string;
  /** ঐচ্ছিক স্থান (≤ MAX_LOCATION) */
  location?: string;
  /** স্পষ্ট slug দিলে সংঘাতে SlugTakenError; না দিলে শিরোনাম থেকে, সংঘাতে suffix */
  slug?: string;
};

/** পথ ক (owner-CSR) — UI ও lib শুধু এই interface দেখে; raw backend field নয় (Arch §১) */
export interface PostRepo {
  get(id: string): Promise<PostWithId | null>;
  /** সর্বশেষ সম্পাদনা আগে; trashed-সহ (UI ফিল্টার করে) — ডিফল্ট ~২০টা; `all:true` = সব (পাতায় পাতায়) */
  list(opts?: { limit?: number; all?: boolean }): Promise<PostWithId[]>;
  create(input: CreatePostInput): Promise<PostWithId>;
  /** লেখা `updatedAt` ফেরত — sync-এর base-stamp (conflict-যাচাই, Arch §১২-ঙ) */
  update(id: string, patch: PostPatch): Promise<Date>;
  /** নতুন slug lock + পুরনো slug `slugHistory`-তে — এক writeBatch-এ */
  changeSlug(id: string, newSlug: string): Promise<PostWithId>;
  /** প্রকাশিত লেখার সম্পাদনা `drafts/{id}`-এ (পাবলিক অপরিবর্তিত) */
  saveEdit(id: string, edit: { title: string; body: string; excerpt: string }): Promise<Date>;
  getDraft(id: string): Promise<Draft | null>;
  /** drafts → posts কপি + drafts মোছা (এক batch); draft না থাকলে null, নইলে নতুন `updatedAt` */
  applyDraft(id: string, wordCount: number): Promise<Date | null>;
  discardDraft(id: string): Promise<void>;
  /** Trash (Arch §৬): থাকা `drafts` আগে posts-এ কপি; status=trashed + trashedAt — এক batch। ইতিমধ্যে trashed হলে no-op */
  trash(id: string): Promise<void>;
  /** trashed → `draft` (slug-lock অক্ষত); trashed না হলে no-op */
  restore(id: string): Promise<void>;
  /** শুধু trashed লেখা: post + নিজের সব slug-lock + drafts এক batch-এ মোছে; trashed না হলে TrashRequiredError */
  deletePermanently(id: string): Promise<void>;
  /**
   * Library filter/খোঁজ (সর্বোচ্চ `limit`, default ৫০; trashed বাদ): সার্ভার-query-তে prefix নইলে category নইলে type, বাকি শর্ত client-এ।
   * সর্বশেষ-সম্পাদনা আগে (prefix-খোঁজে শিরোনাম-ক্রমে)।
   */
  find(opts: FindOpts): Promise<PostWithId[]>;
  /** P8a: দিনের পরিসরে (`from..to`, "YYYY-MM-DD", দুই প্রান্তসহ) diary লেখা, তারিখ-ক্রমে; trashed বাদ; single-field query, index লাগে না */
  listDiary(range: { from: string; to: string }): Promise<PostWithId[]>;
  /** P8a: 'এই দিনে' — নির্দিষ্ট দিনগুলোর (সর্বোচ্চ ১০) diary লেখা; trashed বাদ */
  listDiaryOn(days: string[]): Promise<PostWithId[]>;
  /** trashed লেখা, সর্বোচ্চ ১০০টা (সাজানো UI-তে) */
  listTrashed(): Promise<PostWithId[]>;
  /** সব trashed (১০০টা/বার) মুছে ফেলা; ফল = মোছা/ব্যর্থ সংখ্যা */
  emptyTrash(): Promise<{ deleted: number; failed: number }>;
}

/** পথ খ (build-সময়ে unauthenticated REST) — শুধু published+public, publishedAt desc */
export interface PublicPostSource {
  listPublished(): Promise<PostWithId[]>;
  /** P11c-১: published+unlisted (শুধু সরাসরি লিংকের পেজের জন্য; কোনো তালিকা/সূচিতে নয়) */
  listUnlisted(): Promise<PostWithId[]>;
}
