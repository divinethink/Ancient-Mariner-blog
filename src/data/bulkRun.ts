// Bulk action-এর পরিচালনা (Checklist P3b-ক): sync → তাজা পড়া → plan → commit। সব নির্ভরতা inject করা (test-যোগ্য; syncEngine-এর ছাঁচ)।
// নিরাপত্তা: status-বদলানো ক্রিয়ায় অসংরক্ষিত লোকাল সম্পাদনা থাকা লেখা বাদ (stale body প্রকাশ/ট্র্যাশ হয় না)।
// idempotent: আবার চালালে আগেই-হওয়া লেখা 'unchanged' — তাই "আবার চেষ্টা" = একই request পুনরায়।
import type { CommitResult } from "@/data/postBulk.client";
import {
  planBulk,
  STATUS_KINDS,
  type BulkAction,
  type BulkPost,
  type BulkUpdate,
} from "@/lib/bulk";

export type BulkSpec =
  | { kind: "publish" | "unpublish" | "archive" | "trash" | "restore" | "deleteForever" }
  | { kind: "visibility"; to: "private" | "public" }
  | { kind: "category"; id: string; name: string }
  | { kind: "series"; id: string; name: string };
export type BulkRequest = BulkSpec & { ids: string[] };

export type BulkDeps = {
  syncDirty(): Promise<void>;
  dirtyIds(): Promise<Set<string>>;
  loadPosts(ids: readonly string[]): Promise<BulkPost[]>;
  maxSeriesOrder(seriesId: string, excludeIds: ReadonlySet<string>): Promise<number>;
  ensureDefaultCategory(): Promise<{ id: string; name: string }>;
  commit(
    ups: readonly BulkUpdate[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<CommitResult>;
  deletePermanently(id: string): Promise<void>;
  deleteLocal(ids: readonly string[]): Promise<void>;
  now(): Date;
};

export type BulkSummary = {
  requested: number;
  updated: number;
  /** আগে থেকেই কাঙ্ক্ষিত অবস্থায় */
  unchanged: number;
  /** এই অবস্থার লেখায় প্রযোজ্য নয় */
  notApplicable: number;
  /** অসংরক্ষিত লোকাল সম্পাদনার কারণে বাদ */
  unsynced: number;
  /** সার্ভারে পাওয়া যায়নি */
  missing: number;
  failedIds: string[];
  /** >০ হলে পাবলিক সাইটে প্রভাব — UI একবার rebuild ডাকে */
  affectsPublic: number;
};

export async function runBulk(
  deps: BulkDeps,
  req: BulkRequest,
  onProgress?: (done: number, total: number) => void,
): Promise<BulkSummary> {
  const ids = [...new Set(req.ids)];
  const sum: BulkSummary = {
    requested: ids.length,
    updated: 0,
    unchanged: 0,
    notApplicable: 0,
    unsynced: 0,
    missing: 0,
    failedIds: [],
    affectsPublic: 0,
  };

  await deps.syncDirty().catch(() => undefined); // ব্যর্থ হলে নিচে dirty লেখাগুলো বাদ পড়ে
  const dirty = STATUS_KINDS.includes(req.kind) ? await deps.dirtyIds() : new Set<string>();
  const fresh = await deps.loadPosts(ids);
  sum.missing = ids.length - fresh.length;
  const posts = fresh.filter((p) => {
    if (!dirty.has(p.id)) return true;
    sum.unsynced++;
    return false;
  });

  if (req.kind === "deleteForever") {
    const trashed = posts.filter((p) => p.status === "trashed");
    sum.notApplicable = posts.length - trashed.length;
    const gone: string[] = [];
    for (const [i, p] of trashed.entries()) {
      try {
        await deps.deletePermanently(p.id);
        gone.push(p.id);
        sum.updated++;
      } catch {
        sum.failedIds.push(p.id); // বাকিগুলো চলে; ব্যর্থ অংশ আবার চেষ্টায়
      }
      onProgress?.(i + 1, trashed.length);
    }
    await deps.deleteLocal(gone).catch(() => undefined);
    return sum;
  }

  let action: BulkAction;
  switch (req.kind) {
    case "publish": {
      // ক্যাটাগরিহীন লেখা থাকলে তবেই ডিফল্ট ক্যাটাগরি নিশ্চিত (idempotent)
      const needs = posts.some((p) => p.status === "draft" && !p.categoryId);
      action = {
        kind: "publish",
        defaultCategory: needs ? await deps.ensureDefaultCategory() : null,
      };
      break;
    }
    case "series":
      action = {
        kind: "series",
        id: req.id,
        start: (await deps.maxSeriesOrder(req.id, new Set(ids))) + 1,
      };
      break;
    case "visibility":
      action = { kind: "visibility", to: req.to };
      break;
    case "category":
      action = { kind: "category", id: req.id, name: req.name };
      break;
    default:
      action = { kind: req.kind };
  }

  const plan = planBulk(posts, action, deps.now());
  sum.unchanged = plan.skipped.filter((s) => s.reason === "unchanged").length;
  sum.notApplicable = plan.skipped.filter((s) => s.reason === "status").length;
  if (plan.updates.length === 0) return sum;

  const res = await deps.commit(plan.updates, onProgress);
  sum.updated = res.updatedIds.length;
  sum.failedIds = res.failedIds;
  sum.affectsPublic = res.affectsPublic;
  if (req.kind === "trash") await deps.deleteLocal(res.updatedIds).catch(() => undefined); // ট্র্যাশের লেখা লোকাল-only হয়ে ফেরে না
  return sum;
}
