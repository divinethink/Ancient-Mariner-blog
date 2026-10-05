// Library Bulk actions-এর pure পরিকল্পনা (SDK/UI-মুক্ত; Checklist P3b-ক): কোন লেখায় কী patch বসবে।
// সিদ্ধান্ত: (১) শুধু status বদলালে `updatedAt` ছোঁয়া হয় (খোলা editor-এর conflict-সতর্কতা জাগাতে; Arch §১২-ঙ) —
// category/series/visibility-বদলে নয় (taxonomy-rename-এর নজির; resume-কার্ড/ক্রম স্থির থাকে);
// (২) প্রতিটা ক্রিয়া idempotent — আবার চালালে আগেই-হওয়া লেখা 'unchanged' হয়, নতুন write নয়।
import type { PostStatus, PostVisibility } from "./enums";

/** PostPatch-এর উপসেট (lib → data import নিষিদ্ধ, তাই নিজস্ব; structurally সামঞ্জস্য — adapter-এ PostPatchSchema দিয়ে যাচাই) */
export type BulkPatch = {
  status?: PostStatus;
  visibility?: PostVisibility;
  publishedAt?: Date;
  categoryId?: string | null;
  categoryName?: string | null;
  seriesId?: string | null;
  seriesOrder?: number | null;
};

export type BulkAction =
  | { kind: "publish"; defaultCategory?: { id: string; name: string } | null }
  | { kind: "unpublish" } // → draft (published/archived থেকে)
  | { kind: "archive" }
  | { kind: "trash" }
  | { kind: "restore" } // trashed → draft
  | { kind: "visibility"; to: PostVisibility }
  | { kind: "category"; id: string; name: string }
  | { kind: "series"; id: string; start: number } // পর্ব-নম্বর `start` থেকে, তারিখ-ক্রমে
  | { kind: "deleteForever" }; // শুধু trashed; adapter আলাদা পথে মোছে (plan-এ patch নেই)

export type BulkKind = BulkAction["kind"];

/** যে ক্রিয়ায় লেখার বিষয়বস্তু/অবস্থা বদলায় — অসংরক্ষিত লোকাল সম্পাদনা থাকলে সেই লেখা বাদ (stale body প্রকাশ/ট্র্যাশ এড়াতে) */
export const STATUS_KINDS: readonly BulkKind[] = ["publish", "unpublish", "archive", "trash"];

export type BulkPost = {
  id: string;
  status: PostStatus;
  visibility: PostVisibility;
  publishedAt?: Date;
  createdAt: Date;
  categoryId?: string;
  categoryName?: string;
  seriesId?: string;
  seriesOrder?: number;
};

export type BulkUpdate = {
  id: string;
  patch: BulkPatch;
  /** `null` = ফিল্ড সরানো (restore), Date = বসানো (trash) */
  trashedAt?: Date | null;
  /** status বদলাচ্ছে ⇒ `updatedAt` ছোঁয়া হবে */
  touch: boolean;
  /** published থেকে বেরোচ্ছে ⇒ থাকা `drafts` আগে posts-এ কপি */
  leavesPublished: boolean;
  /** পাবলিক সাইটে প্রভাব (আগে বা পরে published+public) ⇒ rebuild */
  affectsPublic: boolean;
};

export type SkipReason = "status" | "unchanged";
export type BulkPlan = { updates: BulkUpdate[]; skipped: { id: string; reason: SkipReason }[] };

const isPublic = (status: PostStatus, vis: PostVisibility) =>
  status === "published" && vis === "public";

/** এই অবস্থার লেখায় ক্রিয়াটা প্রযোজ্য কিনা (UI-র সংখ্যা-গণনা ও planner একই উৎস); 'unchanged' তথ্য-নির্ভর, এখানে নয় */
export function appliesTo(kind: BulkKind, status: PostStatus): boolean {
  switch (kind) {
    case "publish":
      return status === "draft" || status === "published"; // published ⇒ unchanged
    case "unpublish":
      return status === "draft" || status === "published" || status === "archived";
    case "archive":
      return status === "draft" || status === "published" || status === "archived";
    case "trash":
      return status !== "trashed";
    case "restore":
    case "deleteForever":
      return status === "trashed";
    default:
      return status !== "trashed"; // visibility, category, series
  }
}

function toUpdate(
  p: BulkPost,
  patch: BulkPatch,
  extra: { trashedAt?: Date | null } = {},
): BulkUpdate {
  const nextStatus = patch.status ?? p.status;
  const nextVis = patch.visibility ?? p.visibility;
  return {
    id: p.id,
    patch,
    ...(extra.trashedAt !== undefined ? { trashedAt: extra.trashedAt } : {}),
    touch: patch.status !== undefined,
    leavesPublished: p.status === "published" && nextStatus !== "published",
    affectsPublic: isPublic(p.status, p.visibility) || isPublic(nextStatus, nextVis),
  };
}

/** নির্বাচিত লেখাগুলোর (তাজা ডেটা) ওপর ক্রিয়ার পরিকল্পনা; `deleteForever`-এ updates সবসময় খালি */
export function planBulk(posts: readonly BulkPost[], action: BulkAction, now: Date): BulkPlan {
  const updates: BulkUpdate[] = [];
  const skipped: BulkPlan["skipped"] = [];
  const skip = (p: BulkPost, reason: SkipReason) => skipped.push({ id: p.id, reason });

  if (action.kind === "deleteForever") {
    for (const p of posts) skip(p, "status"); // মোছা adapter-এর আলাদা পথে (slug-lock সহ)
    return { updates, skipped };
  }

  // series: প্রযোজ্য লেখা তারিখ-ক্রমে (createdAt; P3c-তে import-তারিখ জুড়বে) → পর্ব-নম্বর start থেকে
  const order = new Map<string, number>();
  if (action.kind === "series") {
    posts
      .filter((p) => appliesTo("series", p.status))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
      .forEach((p, i) => order.set(p.id, action.start + i));
  }

  for (const p of posts) {
    if (!appliesTo(action.kind, p.status)) {
      skip(p, "status");
      continue;
    }
    switch (action.kind) {
      case "publish": {
        if (p.status === "published") {
          skip(p, "unchanged");
          break;
        }
        // প্রথম প্রকাশে public + এখনকার সময়; আগে প্রকাশিত ছিল হলে visibility/তারিখ অক্ষত (Publish panel-এর মতো)
        const patch: BulkPatch = {
          status: "published",
          ...(p.publishedAt ? {} : { visibility: "public" as const, publishedAt: now }),
          ...(!p.categoryId && action.defaultCategory
            ? { categoryId: action.defaultCategory.id, categoryName: action.defaultCategory.name }
            : {}),
        };
        updates.push(toUpdate(p, patch));
        break;
      }
      case "unpublish":
        if (p.status === "draft") skip(p, "unchanged");
        else updates.push(toUpdate(p, { status: "draft" }));
        break;
      case "archive":
        if (p.status === "archived") skip(p, "unchanged");
        else updates.push(toUpdate(p, { status: "archived" }));
        break;
      case "trash":
        updates.push(toUpdate(p, { status: "trashed" }, { trashedAt: now }));
        break;
      case "restore":
        updates.push(toUpdate(p, { status: "draft" }, { trashedAt: null }));
        break;
      case "visibility":
        if (p.visibility === action.to) skip(p, "unchanged");
        else updates.push(toUpdate(p, { visibility: action.to }));
        break;
      case "category":
        if (p.categoryId === action.id && p.categoryName === action.name) skip(p, "unchanged");
        else updates.push(toUpdate(p, { categoryId: action.id, categoryName: action.name }));
        break;
      case "series": {
        const n = order.get(p.id) as number;
        if (p.seriesId === action.id && p.seriesOrder === n) skip(p, "unchanged");
        else updates.push(toUpdate(p, { seriesId: action.id, seriesOrder: n }));
        break;
      }
    }
  }
  return { updates, skipped };
}

/** UI-র নিশ্চিতকরণ-সংখ্যা: নির্বাচিত অবস্থাগুলোর কতটায় ক্রিয়াটা প্রযোজ্য */
export function countApplicable(kind: BulkKind, statuses: readonly PostStatus[]): number {
  return statuses.filter((s) => appliesTo(kind, s)).length;
}
