// build-এর মন্তব্য-ফল (P11b-২): `scripts/fetch-public-data.ts` লেখে, পোস্ট-পেজ শুধু এই ফাইল পড়ে (popularSnapshot-এর মতো)।
// ফাইল না থাকলে/বিকৃত হলে খালি — পেজে মন্তব্য-তালিকা ফাঁকা, সাইট অক্ষত। শুধু প্রকাশিত-public লেখার মন্তব্য রাখা হয়।
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { PublicComment } from "../lib/comments";

export const COMMENTS_PATH = join(".build-data", "comments.json");

const Row = z.object({
  id: z.string().min(1),
  postId: z.string().min(1),
  authorName: z.string().min(1),
  content: z.string().min(1),
  createdAt: z.string(),
  parentCommentId: z.string().min(1).optional(),
  byOwner: z.boolean().optional(),
});
const Schema = z.object({ items: z.array(Row) });
export type CommentRow = PublicComment & { postId: string };

export async function writeComments(items: readonly CommentRow[], path = COMMENTS_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ items: items.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })) }), "utf8");
}

export async function readComments(path = COMMENTS_PATH): Promise<CommentRow[]> {
  try {
    const x = Schema.safeParse(JSON.parse(await readFile(path, "utf8")));
    return x.success ? x.data.items.map((r) => ({ ...r, createdAt: new Date(r.createdAt) })).filter((r) => !Number.isNaN(r.createdAt.getTime())) : [];
  } catch {
    return [];
  }
}

let memo: Promise<CommentRow[]> | undefined;
/** একটা পোস্টের (অনাথ-বাদে গাছ বানানোর আগের) মন্তব্য; প্রতি worker-এ ফাইল একবার পড়ে */
export async function getPostComments(postId: string): Promise<PublicComment[]> {
  memo ??= readComments();
  return (await memo).filter((c) => c.postId === postId).map((c): PublicComment => ({ id: c.id, authorName: c.authorName, content: c.content, createdAt: c.createdAt, parentCommentId: c.parentCommentId, byOwner: c.byOwner }));
}
