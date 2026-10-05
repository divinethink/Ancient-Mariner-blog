// taxonomyOps = posts + taxonomy-কে ছোঁয়া ক্রিয়া (interface); adapter: taxonomyOps.client.ts (পথ ক)।
// সিদ্ধান্ত: ডিফল্ট ক্যাটাগরির doc-ID স্থির (`default-other`) — ensure idempotent; পরে owner অন্য ক্যাটাগরিকে default করতে পারে
// (`siteSettings.defaultCategoryId`, Arch §৬)। rename-propagation ও backfill `updatedAt` ছোঁয় না — নইলে খোলা editor-এর
// conflict-সতর্কতা (Arch §১২-ঙ) অকারণে জাগত।
import type { TaxonomyKind } from "@/lib/enums";

export const DEFAULT_CATEGORY_ID = "default-other";
export const DEFAULT_CATEGORY_NAME = "অন্যান্য";

export type PropagateResult = {
  /** আপডেট-হওয়া পোস্ট */
  updated: number;
  /** তার মধ্যে পাবলিক সাইটে প্রভাব ফেলে এমন (published+public) — >০ হলে rebuild */
  publishedAffected: number;
  /** ব্যর্থ chunk-এর পোস্ট — আবার চেষ্টা (idempotent) */
  failed: number;
};

export type BackfillResult = PropagateResult & { missing: number };

export interface TaxonomyOps {
  getDefaultCategoryId(): Promise<string | null>;
  /** ডিফল্ট ক্যাটাগরি নিশ্চিত করে (না থাকলে বানায়) ও siteSettings-এ বসায়; idempotent */
  ensureDefaultCategory(): Promise<{ id: string; name: string }>;
  /** কতগুলো লেখা (trashed-সহ) এই term ব্যবহার করছে */
  usage(kind: TaxonomyKind, id: string): Promise<number>;
  /** term-এর নাম বদলে পোস্টের denormalized নাম আপডেট; ব্যর্থ অংশ `failed`-এ */
  rename(kind: TaxonomyKind, id: string, name: string): Promise<PropagateResult>;
  /** শুধু পোস্টের denormalized নাম term-এর বর্তমান নামে মেলায় — "আবার চেষ্টা"; idempotent */
  propagateName(kind: TaxonomyKind, id: string): Promise<PropagateResult>;
  /** guard: ডিফল্ট ক্যাটাগরি, ব্যবহৃত term, সন্তান-ক্যাটাগরি — TermRuleError */
  remove(kind: TaxonomyKind, id: string): Promise<void>;
  /** Migration 001: ক্যাটাগরিহীন (trashed ছাড়া) পোস্টে ডিফল্ট বসায়; শুধু ফিল্ড যোগ — কিছু মোছা/বদলানো নয়; idempotent */
  backfillDefaultCategory(opts: { dryRun: boolean }): Promise<BackfillResult>;
}
