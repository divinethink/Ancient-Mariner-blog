// postRepo = interface + Zod boundary (Arch §২ 'Repo গঠন'); adapter: postRepo.client.ts (পথ ক), postRepo.server.ts (পথ খ)
// Zod শুধু shell field validate করে; `body` (Tiptap JSON string)-র কাঠামো renderer/editor-এ (Arch §২)।
import { z } from "zod";
import { ContentType, PostStatus, PostVisibility } from "@/lib/enums";

export const SCHEMA_VERSION = 1;
const MAX_BODY_BYTES = 900 * 1024; // UTF-8 byte (বাংলা ≈ ৩ byte/অক্ষর) — Arch §৬
const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;
const Body = z.string().refine((s) => utf8Bytes(s) <= MAX_BODY_BYTES, "body সীমা ছাড়িয়েছে");

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
  publishedAt: z.date().optional(),
  trashedAt: z.date().optional(),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(SCHEMA_VERSION),
});

export type Post = z.infer<typeof PostSchema>;
export type PostWithId = Post & { id: string };

/** আংশিক সম্পাদনা — `.partial()` নয় (Zod 4-এ default ঢুকে পড়ত); স্পষ্ট optional */
export const PostPatchSchema = z.object({
  title: z.string().optional(),
  body: Body.optional(),
  excerpt: z.string().optional(),
  wordCount: z.number().int().nonnegative().optional(),
  status: PostStatus.optional(),
  visibility: PostVisibility.optional(),
  publishedAt: z.date().optional(),
});
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
export type PostCard = Pick<
  PostWithId,
  "id" | "title" | "slug" | "excerpt" | "publishedAt" | "wordCount" | "contentType"
>;
export const toPostCard = (p: PostWithId): PostCard => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  excerpt: p.excerpt,
  publishedAt: p.publishedAt,
  wordCount: p.wordCount,
  contentType: p.contentType,
});

const DATE_KEYS = new Set(["publishedAt", "trashedAt", "createdAt", "updatedAt"]);

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

export const parsePost = (id: string, raw: Record<string, unknown>): PostWithId => ({
  ...PostSchema.parse(normalizeRaw(raw)),
  id,
});
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

export type CreatePostInput = {
  /** retry-নিরাপত্তার জন্য editor আগে থেকে id বানিয়ে রাখে; একই id-তে দ্বিতীয় create = বিদ্যমান ফেরত */
  id?: string;
  title: string;
  body: string;
  excerpt?: string;
  wordCount?: number;
  visibility?: PostVisibility;
  /** স্পষ্ট slug দিলে সংঘাতে SlugTakenError; না দিলে শিরোনাম থেকে, সংঘাতে suffix */
  slug?: string;
};

/** পথ ক (owner-CSR) — UI ও lib শুধু এই interface দেখে; raw backend field নয় (Arch §১) */
export interface PostRepo {
  get(id: string): Promise<PostWithId | null>;
  create(input: CreatePostInput): Promise<PostWithId>;
  update(id: string, patch: PostPatch): Promise<void>;
  /** নতুন slug lock + পুরনো slug `slugHistory`-তে — এক writeBatch-এ */
  changeSlug(id: string, newSlug: string): Promise<PostWithId>;
  /** প্রকাশিত লেখার সম্পাদনা `drafts/{id}`-এ (পাবলিক অপরিবর্তিত) */
  saveEdit(id: string, edit: { title: string; body: string; excerpt: string }): Promise<void>;
  getDraft(id: string): Promise<Draft | null>;
  /** drafts → posts কপি + drafts মোছা (এক batch); draft না থাকলে false */
  applyDraft(id: string, wordCount: number): Promise<boolean>;
  discardDraft(id: string): Promise<void>;
}

/** পথ খ (build-সময়ে unauthenticated REST) — শুধু published+public, publishedAt desc */
export interface PublicPostSource {
  listPublished(): Promise<PostWithId[]>;
}
