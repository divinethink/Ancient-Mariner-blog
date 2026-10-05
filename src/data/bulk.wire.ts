// ব্রাউজারে owner-এর Bulk-deps জোগান (lazy; শুধু dashboard)
import { draftStore } from "@/data/draftStore";
import { getOwnerDb } from "@/data/ownerDb";
import { getPostRepo } from "@/data/postRepo.wire";
import { syncAllDirty } from "@/data/syncEngine";
import { getTaxonomyOps } from "@/data/taxonomyOps.wire";
import { runBulk, type BulkRequest, type BulkSummary } from "@/data/bulkRun";

export async function runBulkAction(
  req: BulkRequest,
  onProgress?: (done: number, total: number) => void,
): Promise<BulkSummary> {
  const [{ db }, { createBulkAdapterClient }, repo] = await Promise.all([
    getOwnerDb(),
    import("@/data/postBulk.client"),
    getPostRepo(),
  ]);
  const adapter = createBulkAdapterClient(db);
  return runBulk(
    {
      syncDirty: async () => void (await syncAllDirty(repo, draftStore)),
      dirtyIds: async () =>
        new Set((await draftStore.listDrafts()).filter((d) => d.dirty).map((d) => d.id)),
      loadPosts: adapter.loadPosts,
      maxSeriesOrder: adapter.maxSeriesOrder,
      ensureDefaultCategory: async () => (await getTaxonomyOps()).ensureDefaultCategory(),
      commit: adapter.commit,
      deletePermanently: (id) => repo.deletePermanently(id),
      deleteLocal: async (ids) =>
        void (await Promise.all(
          ids.map((id) => draftStore.deleteDraft(id).catch(() => undefined)),
        )),
      now: () => new Date(),
    },
    req,
    onProgress,
  );
}
