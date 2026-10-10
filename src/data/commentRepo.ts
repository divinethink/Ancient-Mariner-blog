// comments = interface + Zod boundary (P11b-১; Arch §৬)। doc-ID = client-বানানো ২০-অক্ষরের ID (idempotent create)।
// লেখা শুধু privileged route-এ (`data/privileged/commentSubmit.ts`), rules-এ client write নেই; পাঠ: build-সময়ে REST (approved) ও owner।
import { z } from "zod";
import { normalizeRaw } from "@/data/postRepo";
import { CommentStatus } from "@/lib/enums";
import { CONTENT_MAX, NAME_MAX } from "@/lib/comments";

export const COMMENT_SCHEMA_VERSION = 1;

export const CommentSchema = z.object({
  postId: z.string().min(1),
  authorName: z.string().min(1).max(NAME_MAX),
  content: z.string().min(1).max(CONTENT_MAX), // plain-text; render-এ কখনো HTML নয়
  status: CommentStatus.default("approved"),
  parentCommentId: z.string().min(1).optional(),
  byOwner: z.boolean().optional(), // P11b-২: লেখকের নিজের উত্তর; পুরনো doc-এ নেই = পাঠক
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(COMMENT_SCHEMA_VERSION),
});
export type Comment = z.infer<typeof CommentSchema>;
export type CommentWithId = Comment & { id: string };

export const parseComment = (id: string, raw: Record<string, unknown>): CommentWithId => ({
  ...CommentSchema.parse(normalizeRaw(raw)),
  id,
});

/** owner-ড্যাশবোর্ডের পাঠ (P11b-২; rules: owner সব মন্তব্য পড়তে পারে)। লেখা শুধু `/api/owner/comments`-এর privileged পথে */
export interface CommentRepo {
  /** নতুন আগে; সর্বোচ্চ ২০০ — বিকৃত doc বাদ */
  list(): Promise<CommentWithId[]>;
}
