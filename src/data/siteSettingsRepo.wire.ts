// ব্রাউজারে owner-এর SiteSettingsRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { SiteSettingsRepo } from "@/data/siteSettingsRepo";

export async function getSiteSettingsRepo(): Promise<SiteSettingsRepo> {
  const [{ db, uid }, { createSiteSettingsRepoClient }] = await Promise.all([
    getOwnerDb(),
    import("@/data/siteSettingsRepo.client"),
  ]);
  return createSiteSettingsRepoClient(db, uid);
}
