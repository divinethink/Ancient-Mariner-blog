// revisionRepo = interface + Zod boundary; adapter: revisionRepo.client.ts (পথ ক, owner create/read — rules-এ update/delete নিষিদ্ধ)।
// prune/মোছা শুধু Cron (পথ গ, P5a-৩)। snapshot = Tiptap JSON string (Arch §৬)। শুধু post (chapter P14a)।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import { RevisionTargetType, RevisionTrigger } from "@/lib/enums";
import { REVISION_RETAIN, REVISION_SNAPSHOT_MAX_BYTES, utf8Bytes } from "@/lib/revision";

export const REVISION_SCHEMA_VERSION = 1;

export const SnapshotSchema = z
  .string()
  .refine((s) => utf8Bytes(s) <= REVISION_SNAPSHOT_MAX_BYTES, "snapshot সীমা ছাড়িয়েছে");

export const RevisionSchema = z.object({
  targetType: RevisionTargetType.catch("post"),
  targetId: z.string().min(1),
  snapshot: z.string().default(""),
  versionNumber: z.number().int().min(1),
  trigger: RevisionTrigger.catch("manual"),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(REVISION_SCHEMA_VERSION),
});
export type Revision = z.infer<typeof RevisionSchema>;
export type RevisionWithId = Revision & { id: string };

export const parseRevision = (id: string, raw: Record<string, unknown>): RevisionWithId => ({
  ...RevisionSchema.parse(normalizeRaw(raw)),
  id,
});

export type CreateRevisionInput = {
  /** retry/double-submit-নিরাপত্তা (একই id-তে দ্বিতীয় create = বিদ্যমান ফেরত) */
  id?: string;
  targetId: string;
  snapshot: string;
  trigger: RevisionTrigger;
};

/** পথ ক (owner-CSR) */
export interface RevisionRepo {
  /** `versionNumber` অবরোহী (নতুন আগে); `limit` default = REVISION_RETAIN */
  list(targetId: string, opts?: { limit?: number }): Promise<RevisionWithId[]>;
  get(id: string): Promise<RevisionWithId | null>;
  /** versionNumber = সর্বশেষ + ১; একই `id`-তে দ্বিতীয়বার = বিদ্যমান ফেরত (নতুন doc নয়) */
  create(input: CreateRevisionInput): Promise<RevisionWithId>;
}

export { REVISION_RETAIN };
