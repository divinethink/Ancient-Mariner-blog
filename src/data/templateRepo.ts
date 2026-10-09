// templateRepo = interface + Zod boundary (P7b-২); adapter: templateRepo.client.ts (owner-CSR, owner-only rules)।
// `templates` = নিজের সেভ-করা ছাঁচ (বিল্ট-ইন চারটি কোডে — lib/templates)। প্রকাশ-পথে না থাকায় পাবলিক-read নেই।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import { TEMPLATE_NAME_MAX } from "@/lib/templates";

export const TEMPLATE_SCHEMA_VERSION = 1;
const MAX_BODY_BYTES = 900 * 1024; // posts.body-র সমান সীমা (Arch §৬)

/** লেখার সময়ের যাচাই (ইনপুট) */
export const TemplateNameSchema = z.string().trim().min(1).max(TEMPLATE_NAME_MAX);
export const TemplateBodySchema = z
  .string()
  .min(2)
  .refine((s) => new TextEncoder().encode(s).length <= MAX_BODY_BYTES, "body সীমা ছাড়িয়েছে");

/** পড়ার সময় defensive */
export const TemplateSchema = z.object({
  name: z.string().default(""),
  body: z.string().default(""),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(TEMPLATE_SCHEMA_VERSION),
});
export type Template = z.infer<typeof TemplateSchema>;
export type TemplateWithId = Template & { id: string };

export const parseTemplate = (id: string, raw: Record<string, unknown>): TemplateWithId => ({
  ...TemplateSchema.parse(normalizeRaw(raw)),
  id,
});

export type CreateTemplateInput = {
  /** retry/double-submit-নিরাপত্তা: UI আগে id বানায়; একই id-তে দ্বিতীয় create = বিদ্যমান ফেরত */
  id?: string;
  name: string;
  /** Tiptap JSON string (posts.body-র মতো) */
  body: string;
};

export interface TemplateRepo {
  get(id: string): Promise<TemplateWithId | null>;
  /** নতুন আগে; `limit` default ৫০ (তালিকা; aggregation নয়) */
  list(opts?: { limit?: number }): Promise<TemplateWithId[]>;
  create(input: CreateTemplateInput): Promise<TemplateWithId>;
  /** না থাকলেও সফল */
  delete(id: string): Promise<void>;
}
