// ideaRepo = interface + Zod boundary (Arch §২ 'Repo গঠন'); adapter: ideaRepo.client.ts (পথ ক, owner-only rules)।
// `ideas` = আলাদা collection, contentType নয় (Arch §৬)। প্রকাশ-পথে না থাকায় পাবলিক-read নেই।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import { IdeaType } from "@/lib/enums";
import { IDEA_TEXT_MAX, IDEA_TITLE_MAX } from "@/lib/idea";

export const IDEA_SCHEMA_VERSION = 1;

/** লেখার সময়ের যাচাই (ইনপুট) */
export const IdeaTextSchema = z.string().trim().min(1).max(IDEA_TEXT_MAX);
export const IdeaTitleSchema = z.string().trim().max(IDEA_TITLE_MAX);

/** পড়ার সময় defensive: অচেনা `type` → quick (পরের phase-এ enum বাড়লে পুরনো build ভাঙে না) */
export const IdeaSchema = z.object({
  text: z.string().default(""),
  title: z.string().optional(),
  type: IdeaType.catch("quick"),
  /** P14 (Backlog)-এর জন্য সংরক্ষিত; এই phase-এ UI নেই */
  linkedProjectId: z.string().min(1).optional(),
  convertedToPostId: z.string().min(1).optional(),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(IDEA_SCHEMA_VERSION),
});
export type Idea = z.infer<typeof IdeaSchema>;
export type IdeaWithId = Idea & { id: string };

export const parseIdea = (id: string, raw: Record<string, unknown>): IdeaWithId => ({
  ...IdeaSchema.parse(normalizeRaw(raw)),
  id,
});

export type CreateIdeaInput = {
  /** retry/double-submit-নিরাপত্তা: UI আগে id বানায়; একই id-তে দ্বিতীয় create = বিদ্যমান ফেরত */
  id?: string;
  text: string;
  title?: string;
  type?: IdeaType;
};
export type UpdateIdeaInput = {
  text?: string;
  /** `null` = শিরোনাম সরানো; অনুপস্থিত = অপরিবর্তিত */
  title?: string | null;
  type?: IdeaType;
};

export class IdeaNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`আইডিয়া পাওয়া যায়নি: ${id}`);
    this.name = "IdeaNotFoundError";
  }
}

/** পথ ক (owner-CSR) */
export interface IdeaRepo {
  get(id: string): Promise<IdeaWithId | null>;
  /** নতুন আগে; `limit` default ৫০ (তালিকা-preview; aggregation নয়) */
  list(opts?: { limit?: number }): Promise<IdeaWithId[]>;
  create(input: CreateIdeaInput): Promise<IdeaWithId>;
  update(id: string, patch: UpdateIdeaInput): Promise<IdeaWithId>;
  /** idempotent: একই postId দ্বিতীয়বার দিলে বদল নেই */
  markConverted(id: string, postId: string): Promise<IdeaWithId>;
  /** না থাকলেও সফল */
  delete(id: string): Promise<void>;
}
