// ব্রাউজারে owner-এর TaxonomyOps জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { TaxonomyOps } from "@/data/taxonomyOps";

export async function getTaxonomyOps(): Promise<TaxonomyOps> {
  const [{ db, uid }, { createTaxonomyOpsClient }] = await Promise.all([
    getOwnerDb(),
    import("@/data/taxonomyOps.client"),
  ]);
  return createTaxonomyOpsClient(db, uid);
}
