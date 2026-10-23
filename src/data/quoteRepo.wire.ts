// ব্রাউজারে owner-এর QuoteRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { QuoteRepo } from "@/data/quoteRepo";

export async function getQuoteRepo(): Promise<QuoteRepo> {
  const [{ db, uid }, { createQuoteRepoClient }] = await Promise.all([
    getOwnerDb(),
    import("@/data/quoteRepo.client"),
  ]);
  return createQuoteRepoClient(db, uid);
}
