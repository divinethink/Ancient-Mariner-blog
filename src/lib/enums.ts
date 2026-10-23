// enum-মানের একমাত্র source (Dev Rule ১৩); firestore rules এখান থেকে render হয় (scripts/render-rules.ts)
// মান বদলালে: rules re-deploy + rules-test আপডেট বাধ্যতামূলক
import { z } from "zod";

// P2a: draft/published/trashed · P3a: +archived · P11c-১: +scheduled (সময় এলে Cron published করে)
export const POST_STATUS = ["draft", "published", "trashed", "archived", "scheduled"] as const;
// P2a: private/public · P11c-১: +unlisted (লিংকে খোলে; তালিকা/sitemap/search/popular-এ নেই, noindex)
export const POST_VISIBILITY = ["private", "public", "unlisted"] as const;
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
// P3b: ideas (Arch §৬) — Ideas contentType নয়, আলাদা collection; rules-এ enum-তালিকা লাগে না (owner-only)
export const IDEA_TYPE = ["quick", "dialogue", "character", "concept"] as const;
// P3b: notes — Inbox = `organized==false`; P7b-তে ফোন-শেয়ার `shared` ব্যবহার করবে
export const NOTE_KIND = ["note", "shared"] as const;
// P5a: revisions (Arch §৬) — chapter P14a-তে যোগ হবে; rules-এ enum-তালিকা লাগে না (owner-only, Zod boundary-তে যাচাই)
export const REVISION_TARGET_TYPE = ["post", "chapter"] as const;
export const REVISION_TRIGGER = ["publish", "manual", "interval"] as const;
// P5b: backups (Arch §৬) — doc লেখা হয় শুধু সম্পূর্ণ সফল backup-এ; rules-এ enum-তালিকা লাগে না (client write নেই, Zod boundary-তে যাচাই)
export const BACKUP_TYPE = ["auto", "manual"] as const;
export const BACKUP_STATUS = ["complete"] as const;
// P6: media (Arch §৬) — rules-এ enum-তালিকা বসে (visibility পাবলিক-read-এর শর্ত); private ⇒ authenticated delivery
export const MEDIA_TYPE = ["image", "file"] as const;
export const MEDIA_DELIVERY = ["upload", "authenticated"] as const;
export const MEDIA_VISIBILITY = ["public", "private"] as const;
// P11b: comments (Arch §৬) — owner-সিদ্ধান্ত ২০২৬-১০-১০: মডারেশন নেই, জমা = সরাসরি `approved`; `pending` ভবিষ্যতের জন্য সংরক্ষিত (enum extensible),
// `spam` = স্বয়ংক্রিয় (অতিরিক্ত লিংক) বা owner-লুকানো — পাবলিকে অদৃশ্য। rules-এ enum-তালিকা লাগে না (পাবলিক-read শর্ত শুধু 'approved'; client write নেই)
export const COMMENT_STATUS = ["pending", "approved", "spam"] as const;
// P14a-১: writingProjects/chapters (Arch §৬) — rules-এ enum-তালিকা বসে (পাবলিক-read শর্ত: published + public; অধ্যায়ের ক্ষেত্রে প্রজেক্টেরও)
// প্রজেক্টের `type` = মুক্ত লেখা (owner নিজের নাম দিতে পারেন); এই তালিকা শুধু বাছাই-করা প্রিসেট (পুরনো doc-এর novel/story/drama বৈধ থাকে)।
// rules-এ তাই enum-তালিকা নেই — শুধু string ও দৈর্ঘ্য (১–৪০)
export const PROJECT_TYPE = ["novel", "story", "drama", "biography", "history", "memoir", "travelogue"] as const;
export const PROJECT_TYPE_MAX = 40;
export const PROJECT_STATUS = ["draft", "published", "archived"] as const;
export const PROJECT_VISIBILITY = ["private", "public"] as const;
export const CHAPTER_STATUS = ["draft", "published", "trashed"] as const;
export const CHAPTER_VISIBILITY = ["private", "public"] as const;
// দিনলিপি-ঘ: books (Arch §৬) — rules-এ enum-তালিকা বসে (পাবলিক-read শর্ত: visibility == 'public'); quotes সবসময় private (enum নেই)
export const BOOK_STATUS = ["wishlist", "reading", "finished"] as const;
export const BOOK_VISIBILITY = ["private", "public"] as const;
// দিনলিপি-চ: trips (ঘোরার তালিকা) ও specialDays (বিশেষ দিন) — দুটোই শুধু owner; rules-এ enum-তালিকা বসে
export const TRIP_STATUS = ["wish", "been"] as const;
export const SPECIAL_DAY_KIND = ["birthday", "anniversary", "other"] as const;
// Auto = সিস্টেম অনুযায়ী light/dark (Arch §১১)
export const THEME = ["auto", "light", "sepia", "warm", "dark", "amoled"] as const;

export const PostStatus = z.enum(POST_STATUS);
export const PostVisibility = z.enum(POST_VISIBILITY);
export const ContentType = z.enum(CONTENT_TYPE);
export const PageStatus = z.enum(PAGE_STATUS);
export const IdeaType = z.enum(IDEA_TYPE);
export const NoteKind = z.enum(NOTE_KIND);
export const TaxonomyKind = z.enum(TAXONOMY_KIND);
export const Theme = z.enum(THEME);
export const CommentStatus = z.enum(COMMENT_STATUS);
export const ProjectType = z.string().trim().min(1).max(PROJECT_TYPE_MAX);
export const ProjectStatus = z.enum(PROJECT_STATUS);
export const ProjectVisibility = z.enum(PROJECT_VISIBILITY);
export const ChapterStatus = z.enum(CHAPTER_STATUS);
export const ChapterVisibility = z.enum(CHAPTER_VISIBILITY);
export const BookStatus = z.enum(BOOK_STATUS);
export const BookVisibility = z.enum(BOOK_VISIBILITY);
export const TripStatus = z.enum(TRIP_STATUS);
export const SpecialDayKind = z.enum(SPECIAL_DAY_KIND);

/** RSS: পূর্ণ লেখা না সারাংশ (P4b-২) — শুধু siteSettings-এ; Firestore rules-এ নেই */
export const FEED_MODE = ["full", "excerpt"] as const;
export const FeedMode = z.enum(FEED_MODE);
export const RevisionTargetType = z.enum(REVISION_TARGET_TYPE);
export const RevisionTrigger = z.enum(REVISION_TRIGGER);
export const BackupType = z.enum(BACKUP_TYPE);
export const BackupStatus = z.enum(BACKUP_STATUS);
export const MediaType = z.enum(MEDIA_TYPE);
export const MediaDelivery = z.enum(MEDIA_DELIVERY);
export const MediaVisibility = z.enum(MEDIA_VISIBILITY);

export type PostStatus = z.infer<typeof PostStatus>;
export type PostVisibility = z.infer<typeof PostVisibility>;
export type ContentType = z.infer<typeof ContentType>;
export type PageStatus = z.infer<typeof PageStatus>;
export type IdeaType = z.infer<typeof IdeaType>;
export type NoteKind = z.infer<typeof NoteKind>;
export type TaxonomyKind = z.infer<typeof TaxonomyKind>;
export type Theme = z.infer<typeof Theme>;
export type CommentStatus = z.infer<typeof CommentStatus>;
export type ProjectType = z.infer<typeof ProjectType>;
export type ProjectStatus = z.infer<typeof ProjectStatus>;
export type ProjectVisibility = z.infer<typeof ProjectVisibility>;
export type ChapterStatus = z.infer<typeof ChapterStatus>;
export type ChapterVisibility = z.infer<typeof ChapterVisibility>;
export type BookStatus = z.infer<typeof BookStatus>;
export type BookVisibility = z.infer<typeof BookVisibility>;
export type TripStatus = z.infer<typeof TripStatus>;
export type SpecialDayKind = z.infer<typeof SpecialDayKind>;
export type FeedMode = z.infer<typeof FeedMode>;
export type RevisionTargetType = z.infer<typeof RevisionTargetType>;
export type RevisionTrigger = z.infer<typeof RevisionTrigger>;
export type BackupType = z.infer<typeof BackupType>;
export type BackupStatus = z.infer<typeof BackupStatus>;
export type MediaType = z.infer<typeof MediaType>;
export type MediaDelivery = z.infer<typeof MediaDelivery>;
export type MediaVisibility = z.infer<typeof MediaVisibility>;
