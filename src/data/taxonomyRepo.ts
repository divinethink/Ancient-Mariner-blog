// taxonomyRepo = interface + Zod boundary (Arch §২ 'Repo গঠন'); adapter: taxonomyRepo.client.ts (পথ ক)।
// categories / tags / series একই ছাঁচ (Arch §৬ P3a); public-REST পড়া (.server.ts) P4a-তে, যখন পাবলিক route আসে।
// সিদ্ধান্ত: slug তৈরির পর অপরিবর্তিত (rename শুধু `name`) — পাবলিক URL (P4a) স্থির থাকে, redirect লাগে না।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import type { TaxonomyKind } from "@/lib/enums";

export const TAXONOMY_SCHEMA_VERSION = 1;
export const TERM_NAME_MAX = 60;
export const TERM_DESC_MAX = 300;

/** নাম/বিবরণ পাবলিক-readable (rules) — গোপন কিছু নাম হিসেবে নয় (Arch §৬) */
export const TermNameSchema = z.string().trim().min(1).max(TERM_NAME_MAX);
export const TermDescSchema = z.string().trim().max(TERM_DESC_MAX);

export const TermSchema = z.object({
  name: TermNameSchema,
  slug: z.string().min(1),
  description: z.string().default(""),
  /** শুধু categories; সর্বোচ্চ ২ স্তর (Mockup §৭.১৩) */
  parentCategoryId: z.string().min(1).optional(),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(TAXONOMY_SCHEMA_VERSION),
});
export type Term = z.infer<typeof TermSchema>;
export type TermWithId = Term & { id: string };

export const parseTerm = (id: string, raw: Record<string, unknown>): TermWithId => ({
  ...TermSchema.parse(normalizeRaw(raw)),
  id,
});

export type CreateTermInput = {
  /** retry-নিরাপত্তা: editor/UI আগে id বানায়; একই id-তে দ্বিতীয় create = বিদ্যমান ফেরত (idempotent) */
  id?: string;
  name: string;
  description?: string;
  parentCategoryId?: string;
};
export type UpdateTermInput = {
  name?: string;
  description?: string;
  /** `null` = শীর্ষ স্তরে আনা; অনুপস্থিত = অপরিবর্তিত */
  parentCategoryId?: string | null;
};

export class TermNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`পাওয়া যায়নি: ${id}`);
    this.name = "TermNotFoundError";
  }
}
export class TermRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TermRuleError";
  }
}

/** পথ ক (owner-CSR) */
export interface TaxonomyRepo {
  readonly kind: TaxonomyKind;
  /** সব (নাম-ক্রমে); সংখ্যা ছোট — aggregation-এর মতো limit দেওয়া হয় না */
  list(): Promise<TermWithId[]>;
  get(id: string): Promise<TermWithId | null>;
  create(input: CreateTermInput): Promise<TermWithId>;
  /** শুধু taxonomy doc; পোস্টে denormalized নাম আপডেট P3a-২-তে (chunked, retry-যোগ্য) */
  update(id: string, patch: UpdateTermInput): Promise<TermWithId>;
  /** categories: সন্তান থাকলে TermRuleError। 'পোস্টে ব্যবহৃত' ও default-ক্যাটাগরি যাচাই P3a-২-তে UI খোলার আগে। */
  delete(id: string): Promise<void>;
}
