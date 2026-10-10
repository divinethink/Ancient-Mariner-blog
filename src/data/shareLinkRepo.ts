// shareLinks = interface + Zod boundary (P11c-২); adapter: shareLinkRepo.client.ts (owner-CSR, owner-only rules)।
// doc-ID = SHA-256(token) — token নিজে কোথাও নেই। পাবলিক পাঠক rules দিয়ে নয়, Worker-এর privileged পথে (`privileged/shareView.ts`) যাচাই হয়।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";

export const SHARE_SCHEMA_VERSION = 1;

export const ShareLinkSchema = z.object({
  postId: z.string().min(1),
  postTitle: z.string().default(""), // তালিকায় দেখানোর denormalized নাম
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  expiresAt: z.date(),
  revokedAt: z.date().optional(),
  schemaVersion: z.number().int().default(SHARE_SCHEMA_VERSION),
});
export type ShareLink = z.infer<typeof ShareLinkSchema>;
export type ShareLinkWithId = ShareLink & { id: string };

export const parseShareLink = (id: string, raw: Record<string, unknown>): ShareLinkWithId => ({
  ...ShareLinkSchema.parse(normalizeRaw(raw)),
  id,
});

export type CreateShareInput = {
  /** UI আগে token বানায়; একই token-এ দ্বিতীয় create = বিদ্যমান ফেরত (double-submit-এ duplicate নয়) */
  token: string;
  postId: string;
  postTitle: string;
  days: number;
};

export interface ShareLinkRepo {
  /** নতুন আগে; সর্বোচ্চ ১০০ */
  list(): Promise<ShareLinkWithId[]>;
  create(input: CreateShareInput): Promise<ShareLinkWithId>;
  /** idempotent: ইতিমধ্যে revoked হলে অপরিবর্তিত */
  revoke(id: string): Promise<void>;
  /** তালিকা থেকে স্থায়ীভাবে মোছা (শুধু অচল লিংক পরিষ্কার) */
  remove(id: string): Promise<void>;
}
