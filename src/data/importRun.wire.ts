// ব্রাউজারে owner-এর ইমপোর্ট-deps জোগান (lazy; শুধু dashboard)
import { getSlugOwners } from "@/data/importKeys";
import { getOwnerDb } from "@/data/ownerDb";
import { getTaxonomyRepo } from "@/data/taxonomyRepo.wire";
import { runImport, type ImportResult } from "@/data/importRun";
import type { ImportPlan } from "@/lib/import/plan";

export async function runWpImport(
  plan: ImportPlan,
  site: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const [{ db, uid }, { commitImportRows }] = await Promise.all([getOwnerDb(), import("@/data/importPosts.client")]);
  return runImport(
    {
      owners: getSlugOwners,
      terms: async (kind) => (await (await getTaxonomyRepo(kind)).list()).map((t) => ({ id: t.id, name: t.name })),
      createTerm: async (kind, id, name) => (await getTaxonomyRepo(kind)).create({ id, name }),
      commit: (rows) => commitImportRows(db, uid, rows),
      wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    },
    plan,
    site,
    onProgress,
  );
}
