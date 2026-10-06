// ব্রাউজারে বিদ্যমান slug-তালিকা জোগান (lazy)
import { getOwnerDb } from "@/data/ownerDb";

export async function getExistingSlugs(): Promise<Set<string>> {
  const [{ db }, { readExistingSlugs }] = await Promise.all([getOwnerDb(), import("@/data/importKeys.client")]);
  return readExistingSlugs(db);
}
