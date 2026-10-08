// ব্রাউজারে owner-এর PageRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { PageRepo } from "@/data/pageRepo";

export async function getPageRepo(): Promise<PageRepo> {
  const [{ db, uid }, { createPageRepoClient }] = await Promise.all([getOwnerDb(), import("@/data/pageRepo.client")]);
  return createPageRepoClient(db, uid);
}
