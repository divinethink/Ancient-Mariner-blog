// bookmarkRepo = interface + Zod boundary (P12-৩); adapter: bookmarkRepo.client.ts (পথ ক, owner-only rules)।
// `bookmarks/{postId}` (doc-ID = postId ⇒ দ্বিতীয়বার বুকমার্কে duplicate অসম্ভব) ও `highlights/{id}` (নির্বাচিত লেখার plain-text উদ্ধৃতি)।
// পাবলিক-read নেই; শুধু owner-এর dashboard। উদ্ধৃতি text-ভিত্তিক (offset নয়) — লেখা সম্পাদনায় anchor ভাঙার ঝুঁকি নেই।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import { QUOTE_MAX, QUOTE_MIN } from "@/lib/reader";

export const MARKS_SCHEMA_VERSION = 1;
export const MARKS_PAGE = 100; // তালিকা-preview সীমা (aggregation নয়)
export const MARK_TITLE_MAX = 300;

export const MarkPostIdSchema = z.string().regex(/^[A-Za-z0-9]{1,40}$/);
export const MarkTitleSchema = z.string().trim().max(MARK_TITLE_MAX);
/** লেখার সময়ের যাচাই: whitespace গুটানো, দৈর্ঘ্য QUOTE_MIN–QUOTE_MAX (reader.cleanQuote-এর সঙ্গে সমান) */
export const HighlightQuoteSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, " ").trim())
  .refine((s) => [...s].length >= QUOTE_MIN && [...s].length <= QUOTE_MAX);

/** পড়ার সময় defensive (পুরনো/বিকৃত doc যেন তালিকা না ভাঙে) */
export const BookmarkSchema = z.object({
  postId: z.string().min(1),
  postTitle: z.string().default(""),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  schemaVersion: z.number().int().default(MARKS_SCHEMA_VERSION),
});
export type Bookmark = z.infer<typeof BookmarkSchema>;

export const HighlightSchema = z.object({
  postId: z.string().min(1),
  postTitle: z.string().default(""),
  quote: z.string().min(1),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  schemaVersion: z.number().int().default(MARKS_SCHEMA_VERSION),
});
export type Highlight = z.infer<typeof HighlightSchema>;
export type HighlightWithId = Highlight & { id: string };

export const parseBookmark = (id: string, raw: Record<string, unknown>): Bookmark => BookmarkSchema.parse({ ...normalizeRaw(raw), postId: id });
export const parseHighlight = (id: string, raw: Record<string, unknown>): HighlightWithId => ({ ...HighlightSchema.parse(normalizeRaw(raw)), id });

export type AddHighlightInput = {
  /** retry/double-submit-নিরাপত্তা: UI আগে id বানায়; একই id-তে দ্বিতীয় create = বিদ্যমান ফেরত */
  id: string;
  postId: string;
  postTitle: string;
  quote: string;
};

/** পথ ক (owner-CSR) */
export interface BookmarkRepo {
  isBookmarked(postId: string): Promise<boolean>;
  /** idempotent: আগে থেকে থাকলে বদল নেই */
  addBookmark(postId: string, postTitle: string): Promise<void>;
  /** না থাকলেও সফল */
  removeBookmark(postId: string): Promise<void>;
  /** নতুন আগে; `limit` default MARKS_PAGE */
  listBookmarks(opts?: { limit?: number }): Promise<Array<Bookmark & { id: string }>>;
  addHighlight(input: AddHighlightInput): Promise<void>;
  listHighlights(opts?: { limit?: number }): Promise<HighlightWithId[]>;
  /** না থাকলেও সফল */
  deleteHighlight(id: string): Promise<void>;
}
