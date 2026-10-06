// editor/publish/history থেকে ডাকার wire-সংস্করণ (best-effort: snapshot ব্যর্থ হলে মূল কাজ আটকায় না — caller `.catch`)।
import { draftStore } from "@/data/draftStore";
import { localStore } from "@/data/localStore";
import { getPostRepo } from "@/data/postRepo.wire";
import { maybeIntervalSnapshot, snapshotCurrent } from "@/data/revisionActions";
import { getRevisionRepo } from "@/data/revisionRepo.wire";
import { revisionKey } from "@/lib/revision";

/** Firestore sync সফল হলে: লোকাল (= এইমাত্র sync-হওয়া) body থেকে, ১০ মিনিটে ≤১টা */
export async function snapshotAfterSync(postId: string): Promise<void> {
  const local = await draftStore.loadDraft(postId);
  if (local) await maybeIntervalSnapshot(getRevisionRepo, localStore, postId, local.body);
}

/** প্রকাশ/আপডেট-প্রকাশের পর: প্রকাশিত অবস্থার snapshot */
export async function snapshotOnPublish(postId: string): Promise<void> {
  const [posts, revs] = await Promise.all([getPostRepo(), getRevisionRepo()]);
  await snapshotCurrent(posts, revs, postId, "publish");
  await localStore.set(revisionKey(postId), Date.now());
}
