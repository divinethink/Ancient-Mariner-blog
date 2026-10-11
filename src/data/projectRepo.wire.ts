// ব্রাউজারে owner-এর ProjectRepo জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";
import type { ProjectRepo } from "@/data/projectRepo";

export async function getProjectRepo(): Promise<ProjectRepo> {
  const [{ db, uid }, { createProjectRepoClient }] = await Promise.all([getOwnerDb(), import("@/data/projectRepo.client")]);
  return createProjectRepoClient(db, uid);
}
