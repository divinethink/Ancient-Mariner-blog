// অধ্যায়-editor/history থেকে ডাকার wire-সংস্করণ (best-effort: snapshot ব্যর্থ হলে মূল কাজ আটকায় না — caller `.catch`)। P14a-৩।
import { snapshotChapterCurrent } from "@/data/chapterRevisionActions";
import { localStore } from "@/data/localStore";
import { getProjectRepo } from "@/data/projectRepo.wire";
import { maybeIntervalSnapshot } from "@/data/revisionActions";
import { scopedRevisionRepo } from "@/data/revisionRepo";
import { getRevisionRepo } from "@/data/revisionRepo.wire";
import { revisionKey } from "@/lib/revision";

/** সার্ভারে সম্পাদনা সংরক্ষণের পর: এইমাত্র সংরক্ষিত body থেকে, ১০ মিনিটে ≤১টা */
export async function chapterSnapshotAfterSync(chapterId: string, body: string): Promise<void> {
  await maybeIntervalSnapshot(async () => scopedRevisionRepo(await getRevisionRepo(), "chapter"), localStore, chapterId, body);
}

/** প্রকাশ/আপডেট-প্রকাশের পর: প্রকাশিত অবস্থার snapshot */
export async function chapterSnapshotOnPublish(chapterId: string): Promise<void> {
  const [projects, revs] = await Promise.all([getProjectRepo(), getRevisionRepo()]);
  await snapshotChapterCurrent(projects, revs, chapterId, "publish");
  await localStore.set(revisionKey(chapterId), Date.now());
}
