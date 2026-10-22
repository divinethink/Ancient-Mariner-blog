// letterRepo = interface + Zod boundary; adapter: letterRepo.client.ts (পথ ক, owner-only rules)।
// ভবিষ্যতের চিঠি (দিনলিপি-গ): তালা শুধু UI-তে — লেখা Firestore/ব্যাকআপে সাধারণ থাকে (owner-অনুমোদিত সীমা); পাবলিক read নেই।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import { LETTER_BODY_MAX, LETTER_TITLE_MAX } from "@/lib/letters";

export const LETTER_SCHEMA_VERSION = 1;

export const LetterTitleSchema = z.string().trim().max(LETTER_TITLE_MAX);
export const LetterBodySchema = z.string().trim().min(1).max(LETTER_BODY_MAX);

export const LetterSchema = z.object({
  title: z.string().default(""),
  body: z.string().default(""),
  /** খোলার মুহূর্ত (UTC; সাইট-timezone-এর মধ্যরাত) */
  openAt: z.date(),
  /** প্রথম খোলা-পড়ার সময়; নেই ⇒ এখনো পড়া হয়নি */
  openedAt: z.date().optional(),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(LETTER_SCHEMA_VERSION),
});
export type Letter = z.infer<typeof LetterSchema>;
export type LetterWithId = Letter & { id: string };

export const parseLetter = (id: string, raw: Record<string, unknown>): LetterWithId => ({
  ...LetterSchema.parse(normalizeRaw(raw)),
  id,
});

export type CreateLetterInput = {
  /** retry/double-submit-নিরাপত্তা (একই id-তে দ্বিতীয় create = বিদ্যমান ফেরত) */
  id?: string;
  title?: string;
  body: string;
  openAt: Date;
};

export class LetterNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`চিঠি পাওয়া যায়নি: ${id}`);
    this.name = "LetterNotFoundError";
  }
}
export class LetterDateError extends Error {
  constructor() {
    super("খোলার তারিখ ভবিষ্যতের হতে হবে");
    this.name = "LetterDateError";
  }
}

/** পথ ক (owner-CSR) */
export interface LetterRepo {
  /** খোলার তারিখ অনুযায়ী (আগে যেটা খুলবে); সর্বোচ্চ ২০০ */
  list(): Promise<LetterWithId[]>;
  /** খোলার সময় হয়েছে অথচ এখনো পড়া হয়নি এমন চিঠি (সর্বশেষ ১০টি খোলার মধ্য থেকে; হোম-কার্ডের জন্য) */
  listReady(now: number): Promise<LetterWithId[]>;
  create(input: CreateLetterInput): Promise<LetterWithId>;
  /** idempotent: আগেই `openedAt` থাকলে বদল নেই */
  markOpened(id: string): Promise<LetterWithId>;
  /** না থাকলেও সফল */
  delete(id: string): Promise<void>;
}
