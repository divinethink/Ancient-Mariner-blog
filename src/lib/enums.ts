// enum-মানের একমাত্র source (Dev Rule ১৩); firestore rules এখান থেকে render হয় (scripts/render-rules.ts)
// মান বদলালে: rules re-deploy + rules-test আপডেট বাধ্যতামূলক
import { z } from "zod";

// P2a: draft/published/trashed · P3a: +archived (এখন) · P11c: +scheduled
export const POST_STATUS = ["draft", "published", "trashed", "archived"] as const;
// P2a: private/public · P11c: +unlisted
export const POST_VISIBILITY = ["private", "public"] as const;
// P2a: `post` ফিক্সড · P3a: পূর্ণ enum (`novel`/`idea` নেই — Arch §৬)
export const CONTENT_TYPE = [
  "post",
  "diary",
  "story",
  "poetry",
  "essay",
  "travel",
  "science",
  "religious",
  "research",
] as const;
// P3a: categories/tags/series (Arch §৬)
export const TAXONOMY_KIND = ["categories", "tags", "series"] as const;
export const PAGE_STATUS = ["draft", "published"] as const;
// Auto = সিস্টেম অনুযায়ী light/dark (Arch §১১)
export const THEME = ["auto", "light", "sepia", "warm", "dark", "amoled"] as const;

export const PostStatus = z.enum(POST_STATUS);
export const PostVisibility = z.enum(POST_VISIBILITY);
export const ContentType = z.enum(CONTENT_TYPE);
export const PageStatus = z.enum(PAGE_STATUS);
export const TaxonomyKind = z.enum(TAXONOMY_KIND);
export const Theme = z.enum(THEME);

export type PostStatus = z.infer<typeof PostStatus>;
export type PostVisibility = z.infer<typeof PostVisibility>;
export type ContentType = z.infer<typeof ContentType>;
export type PageStatus = z.infer<typeof PageStatus>;
export type TaxonomyKind = z.infer<typeof TaxonomyKind>;
export type Theme = z.infer<typeof Theme>;
