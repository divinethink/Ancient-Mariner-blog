// ব্রাউজারে owner-এর TaxonomyRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { TaxonomyRepo } from "@/data/taxonomyRepo";
import type { TaxonomyKind } from "@/lib/enums";

export async function getTaxonomyRepo(kind: TaxonomyKind): Promise<TaxonomyRepo> {
  const [{ db, uid }, { createTaxonomyRepoClient }] = await Promise.all([
    getOwnerDb(),
    import("@/data/taxonomyRepo.client"),
  ]);
  return createTaxonomyRepoClient(db, uid, kind);
}
