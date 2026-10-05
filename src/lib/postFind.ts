// Library filter/খোঁজের pure অংশ (SDK/UI-মুক্ত; Checklist P3a-২খ)।
// সার্ভার-query-তে একটাই সীমা (prefix, নইলে category, নইলে type) বসে — composite index-সংখ্যা ২-এ আটকে রাখতে;
// বাকি শর্ত `matchesFind` দিয়ে ফল-তালিকায় (ট্র্যাশ সবসময় বাদ — ট্র্যাশের নিজস্ব ফিল্টার আছে)।
import type { ContentType } from "./enums";

export type FindOpts = {
  /** শিরোনামের শুরুর অংশ (case-sensitive; বাংলায় case নেই) */
  titlePrefix?: string;
  contentType?: ContentType;
  categoryId?: string;
  limit?: number;
};

export const FIND_LIMIT = 50;

export type ServerKey = "prefix" | "category" | "type" | "none";

/** কোন শর্তটা সার্ভার-query-তে যাবে */
export function serverKey(o: FindOpts): ServerKey {
  if (o.titlePrefix?.trim()) return "prefix";
  if (o.categoryId) return "category";
  if (o.contentType) return "type";
  return "none";
}

/** prefix-range: `[p, p+]` */
export function titleRange(prefix: string): [string, string] {
  const p = prefix.trim();
  return [p, `${p}`];
}

type PostLike = { status: string; contentType: ContentType; categoryId?: string; title: string };

/** সার্ভার-ফলের ওপর বাকি শর্ত (সব শর্তেরই AND; ট্র্যাশ বাদ) */
export function matchesFind(p: PostLike, o: FindOpts): boolean {
  if (p.status === "trashed") return false;
  if (o.contentType && p.contentType !== o.contentType) return false;
  if (o.categoryId && p.categoryId !== o.categoryId) return false;
  const prefix = o.titlePrefix?.trim();
  if (prefix && !p.title.startsWith(prefix)) return false;
  return true;
}
