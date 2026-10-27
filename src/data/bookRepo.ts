// bookRepo = interface + Zod boundary; adapter: bookRepo.client.ts (পথ ক, owner-CSR)।
// পড়ার তাক (দিনলিপি-ঘ): ডিফল্ট `visibility='private'`; অজানা মান পড়লে private ধরা (নিরাপদ দিক)। পাবলিক পাতা পরের ধাপে (rules-এ পাবলিক-read আগেই প্রস্তুত)।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import { BookStatus, BookVisibility } from "@/lib/enums";
import { BOOK_AUTHOR_MAX, BOOK_NOTE_MAX, BOOK_TITLE_MAX, isDayKey } from "@/lib/books";

export const BOOK_SCHEMA_VERSION = 1;

export const BookTitleSchema = z.string().trim().min(1).max(BOOK_TITLE_MAX);
export const BookAuthorSchema = z.string().trim().max(BOOK_AUTHOR_MAX);
export const CoverIdSchema = z.string().regex(/^[A-Za-z0-9]{1,40}$/);
export const BookNoteSchema = z.string().trim().max(BOOK_NOTE_MAX);
const DaySchema = z.string().refine(isDayKey);

export const BookSchema = z.object({
  title: z.string().default(""),
  author: z.string().default(""),
  status: BookStatus.catch("wishlist"),
  visibility: BookVisibility.catch("private"),
  note: z.string().default(""),
  coverMediaId: z.string().regex(/^[A-Za-z0-9]{1,40}$/).optional().catch(undefined), // মলাট-ছবি = `media/{id}` (পাবলিক ছবি); পুরনো doc-এ নেই = মলাট নেই
  startDay: DaySchema.optional().catch(undefined),
  endDay: DaySchema.optional().catch(undefined),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(BOOK_SCHEMA_VERSION),
});
export type Book = z.infer<typeof BookSchema>;
export type BookWithId = Book & { id: string };

export const parseBook = (id: string, raw: Record<string, unknown>): BookWithId => ({
  ...BookSchema.parse(normalizeRaw(raw)),
  id,
});

export type CreateBookInput = {
  /** retry/double-submit-নিরাপত্তা (একই id-তে দ্বিতীয় create = বিদ্যমান ফেরত) */
  id?: string;
  title: string;
  author?: string;
  /** বর্ণনা (ঐচ্ছিক) — `note` ফিল্ডেই যায়, নতুন ফিল্ড নয় */
  note?: string;
  /** মলাট-ছবি (ঐচ্ছিক) — `media/{id}` */
  coverMediaId?: string;
  status: BookStatus;
  startDay?: string;
  endDay?: string;
};
export type BookPatch = {
  title?: string;
  author?: string;
  status?: BookStatus;
  visibility?: BookVisibility;
  note?: string;
  /** null = মলাট সরানো */
  coverMediaId?: string | null;
  startDay?: string;
  endDay?: string;
};

export class BookNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`বই পাওয়া যায়নি: ${id}`);
    this.name = "BookNotFoundError";
  }
}

/** পথ ক (owner-CSR) */
export interface BookRepo {
  /** সব বই, সাম্প্রতিক-সম্পাদনা আগে; সর্বোচ্চ ৫০০ */
  list(): Promise<BookWithId[]>;
  create(input: CreateBookInput): Promise<BookWithId>;
  /** idempotent (একই মান দ্বিতীয়বার দিলে ফল একই) */
  update(id: string, patch: BookPatch): Promise<BookWithId>;
  /** না থাকলেও সফল */
  delete(id: string): Promise<void>;
}
