// quoteRepo = interface + Zod boundary; adapter: quoteRepo.client.ts (পথ ক)। উদ্ধৃতি সবসময় private (পাবলিক-read নেই; কপিরাইট ও গোপনীয়তা)।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import { QUOTE_MAX, QUOTE_PAGE_MAX } from "@/lib/books";

export const QUOTE_SCHEMA_VERSION = 1;

export const QuoteTextSchema = z.string().trim().min(1).max(QUOTE_MAX);
export const QuotePageSchema = z.string().trim().max(QUOTE_PAGE_MAX);

export const QuoteSchema = z.object({
  text: z.string().default(""),
  bookId: z.string().optional(),
  /** বইয়ের নাম-কপি (বই মুছলেও উদ্ধৃতির উৎস দেখা যায়) */
  bookTitle: z.string().optional(),
  page: z.string().optional(),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(QUOTE_SCHEMA_VERSION),
});
export type Quote = z.infer<typeof QuoteSchema>;
export type QuoteWithId = Quote & { id: string };

export const parseQuote = (id: string, raw: Record<string, unknown>): QuoteWithId => ({
  ...QuoteSchema.parse(normalizeRaw(raw)),
  id,
});

export type CreateQuoteInput = {
  /** retry/double-submit-নিরাপত্তা */
  id?: string;
  text: string;
  bookId?: string;
  bookTitle?: string;
  page?: string;
};

export class QuoteNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`উদ্ধৃতি পাওয়া যায়নি: ${id}`);
    this.name = "QuoteNotFoundError";
  }
}

/** পথ ক (owner-CSR) */
export interface QuoteRepo {
  /** নতুন আগে; সর্বোচ্চ ২০০ */
  list(): Promise<QuoteWithId[]>;
  create(input: CreateQuoteInput): Promise<QuoteWithId>;
  /** না থাকলেও সফল */
  delete(id: string): Promise<void>;
}
