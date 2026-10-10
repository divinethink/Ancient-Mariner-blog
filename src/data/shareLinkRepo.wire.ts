// ব্রাউজারে owner-এর ShareLinkRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { ShareLinkRepo } from "@/data/shareLinkRepo";

export async function getShareLinkRepo(): Promise<ShareLinkRepo> {
  const [{ db, uid }, { createShareLinkRepoClient }] = await Promise.all([getOwnerDb(), import("@/data/shareLinkRepo.client")]);
  return createShareLinkRepoClient(db, uid);
}
