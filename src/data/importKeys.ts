// ব্রাউজারে বিদ্যমান slug-তালিকা জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";

export async function getSlugOwners(): Promise<Map<string, string>> {
  const [{ db }, { readSlugOwners }] = await Promise.all([getOwnerDb(), import("@/data/importKeys.client")]);
  return readSlugOwners(db);
}

export async function getExistingSlugs(): Promise<Set<string>> {
  return new Set((await getSlugOwners()).keys());
}
