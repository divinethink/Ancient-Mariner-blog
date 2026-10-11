// অধ্যায়ের revisions-orchestration (SDK-মুক্ত; শুধু ProjectRepo/RevisionRepo interface দেখে — test-যোগ্য)। P14a-৩।
// নীতি `revisionActions`-এর মতোই: snapshot = সম্পাদনার বর্তমান body (প্রকাশিত অধ্যায়ে `drafts`-এর, নইলে `chapters`-এর);
// Restore = শুধু body প্রতিস্থাপন (প্রকাশিত অধ্যায়ে `drafts`-এ — পাবলিকে যায় [আপডেট প্রকাশ করুন]-এর পর), তার আগে বর্তমান অবস্থার snapshot।
// snapshot/interval যুক্তি `revisionActions` থেকেই reuse — শুধু revision-repo-তে `scopedRevisionRepo(.., "chapter")` বসে।
import type { ProjectRepo } from "@/data/projectRepo";
import { snapshotIfChanged, textOf } from "@/data/revisionActions";
import type { RevisionRepo, RevisionWithId } from "@/data/revisionRepo";
import { scopedRevisionRepo } from "@/data/revisionRepo";
import { countWords } from "@/lib/editorDoc";
import type { RevisionTrigger } from "@/lib/enums";

const wordsOf = (body: string): number => countWords(textOf(body));

/** অধ্যায়ের কার্যকর সম্পাদনা-অবস্থা: প্রকাশিত হলে drafts আগে, নইলে অধ্যায়। trashed/নেই ⇒ null */
export async function currentChapterEdit(projects: ProjectRepo, id: string) {
  const ch = await projects.getChapter(id);
  if (!ch || ch.status === "trashed") return null;
  const published = ch.status === "published";
  const draft = published ? await projects.getChapterDraft(id) : null;
  const cur = draft ?? ch;
  return { published, title: cur.title, body: cur.body };
}

/** বর্তমান অবস্থার snapshot (প্রকাশ/ম্যানুয়াল)। অধ্যায় নেই/trashed ⇒ null */
export async function snapshotChapterCurrent(
  projects: ProjectRepo,
  revs: RevisionRepo,
  id: string,
  trigger: RevisionTrigger,
): Promise<RevisionWithId | null> {
  const cur = await currentChapterEdit(projects, id);
  return cur ? snapshotIfChanged(scopedRevisionRepo(revs, "chapter"), id, cur.body, trigger) : null;
}

export type ChapterRestoreResult =
  | { kind: "restored"; published: boolean }
  | { kind: "same" }
  | { kind: "unavailable" };

/** আগে বর্তমান অবস্থার snapshot (ব্যর্থ হলে restore হয় না — কিছু হারায় না); তারপর body প্রতিস্থাপন */
export async function restoreChapterRevision(
  projects: ProjectRepo,
  revs: RevisionRepo,
  revisionId: string,
): Promise<ChapterRestoreResult> {
  const rev = await revs.get(revisionId);
  if (!rev || rev.targetType !== "chapter") return { kind: "unavailable" };
  const cur = await currentChapterEdit(projects, rev.targetId);
  if (!cur) return { kind: "unavailable" };
  if (cur.body === rev.snapshot) return { kind: "same" };

  await snapshotIfChanged(scopedRevisionRepo(revs, "chapter"), rev.targetId, cur.body, "manual");

  const words = wordsOf(rev.snapshot);
  if (cur.published) {
    await projects.saveChapterEdit(rev.targetId, { title: cur.title, body: rev.snapshot, wordCount: words });
  } else {
    await projects.updateChapter(rev.targetId, { body: rev.snapshot, wordCount: words });
  }
  return { kind: "restored", published: cur.published };
}
