// ব্রাউজারে owner-এর TemplateRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { TemplateRepo } from "@/data/templateRepo";

export async function getTemplateRepo(): Promise<TemplateRepo> {
  const [{ db, uid }, { createTemplateRepoClient }] = await Promise.all([
    getOwnerDb(),
    import("@/data/templateRepo.client"),
  ]);
  return createTemplateRepoClient(db, uid);
}
