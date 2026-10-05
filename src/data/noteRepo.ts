// noteRepo = interface + Zod boundary; adapter: noteRepo.client.ts (পথ ক, owner-only rules)।
// Inbox = `organized == false` (Arch §৬)। P7b-তে ফোন-শেয়ার একই `create` ব্যবহার করবে (kind='shared')।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import { NoteKind } from "@/lib/enums";
import { IDEA_TITLE_MAX, NOTE_CONTENT_MAX } from "@/lib/idea";

export const NOTE_SCHEMA_VERSION = 1;

export const NoteContentSchema = z.string().trim().min(1).max(NOTE_CONTENT_MAX);
export const NoteTitleSchema = z.string().trim().max(IDEA_TITLE_MAX);

export const NoteSchema = z.object({
  content: z.string().default(""),
  title: z.string().optional(),
  kind: NoteKind.catch("note"),
  /** পুরনো/অসম্পূর্ণ doc-এ নেই ⇒ false (Inbox-এ দেখা যায়, হারায় না) */
  organized: z.boolean().default(false),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(NOTE_SCHEMA_VERSION),
});
export type Note = z.infer<typeof NoteSchema>;
export type NoteWithId = Note & { id: string };

export const parseNote = (id: string, raw: Record<string, unknown>): NoteWithId => ({
  ...NoteSchema.parse(normalizeRaw(raw)),
  id,
});

export type CreateNoteInput = {
  /** retry/double-submit-নিরাপত্তা (একই id-তে দ্বিতীয় create = বিদ্যমান ফেরত) */
  id?: string;
  content: string;
  title?: string;
  kind?: NoteKind;
};

export class NoteNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`নোট পাওয়া যায়নি: ${id}`);
    this.name = "NoteNotFoundError";
  }
}

/** পথ ক (owner-CSR) */
export interface NoteRepo {
  /** `organized` অনুযায়ী, নতুন আগে; `limit` default ৫০ */
  list(opts: { organized: boolean; limit?: number }): Promise<NoteWithId[]>;
  create(input: CreateNoteInput): Promise<NoteWithId>;
  /** idempotent (একই মান দ্বিতীয়বার দিলে বদল নেই) */
  setOrganized(id: string, organized: boolean): Promise<NoteWithId>;
  /** না থাকলেও সফল */
  delete(id: string): Promise<void>;
  /** Inbox-সংখ্যা (অসংগঠিত নোট) — server-side count(), ১ read */
  countInbox(): Promise<number>;
}
