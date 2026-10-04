// postRepo = interface + Zod boundary (Arch §২ 'Repo গঠন'); adapter: postRepo.client.ts (পথ ক), postRepo.server.ts (পথ খ) — P2a-তে
// Zod শুধু shell field validate করে; `body` (Tiptap JSON string)-র কাঠামো renderer/editor-এ (Arch §২)।
import { z } from "zod";
import { ContentType, PostStatus, PostVisibility } from "@/lib/enums";

const MAX_BODY_BYTES = 900 * 1024; // UTF-8 byte (বাংলা ≈ ৩ byte/অক্ষর) — Arch §৬
const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

export const PostSchema = z.object({
  title: z.string(),
  slug: z.string().min(1),
  contentType: ContentType.default("post"),
  body: z.string().refine((s) => utf8Bytes(s) <= MAX_BODY_BYTES, "body সীমা ছাড়িয়েছে"),
  excerpt: z.string().default(""),
  status: PostStatus,
  visibility: PostVisibility,
  wordCount: z.number().int().nonnegative().default(0),
  publishedAt: z.date().optional(),
  trashedAt: z.date().optional(),
  ownerUid: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  schemaVersion: z.number().int().default(1),
});

export type Post = z.infer<typeof PostSchema>;
export type PostWithId = Post & { id: string };

/** UI ও lib শুধু এই interface দেখে; raw backend field নয় (Arch §১) */
export interface PostRepo {
  get(id: string): Promise<PostWithId | null>;
}
