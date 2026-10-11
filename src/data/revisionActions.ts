// revisions-এর orchestration (SDK-মুক্ত; শুধু PostRepo/RevisionRepo interface দেখে — test-যোগ্য)। P5a-২।
// নীতি (Arch §৬/§১৫): snapshot = সম্পাদনার বর্তমান body (প্রকাশিত লেখায় `drafts`-এর, নইলে `posts`-এর);
// Restore = শুধু body প্রতিস্থাপন (প্রকাশিত লেখায় `drafts`-এ — পাবলিকে যায় [আপডেট প্রকাশ করুন]-এর পর), তার আগে বর্তমান অবস্থার snapshot।
import type { PostRepo } from "@/data/postRepo";
import type { RevisionRepo, RevisionWithId } from "@/data/revisionRepo";
import { countWords, docToText, makeExcerpt, parseBody } from "@/lib/editorDoc";
import type { RevisionTrigger } from "@/lib/enums";
import { intervalDue, revisionKey } from "@/lib/revision";

export const textOf = (body: string) => docToText(parseBody(body));
export const bodyWords = (body: string): number => countWords(textOf(body));

/** সর্বশেষ snapshot-এর সাথে হুবহু এক হলে কিছু বানায় না (null); নইলে নতুনটা */
export async function snapshotIfChanged(
  revs: RevisionRepo,
  targetId: string,
  body: string,
  trigger: RevisionTrigger,
): Promise<RevisionWithId | null> {
  const latest = (await revs.list(targetId, { limit: 1 }))[0];
  if (latest && latest.snapshot === body) return null;
  return revs.create({ targetId, snapshot: body, trigger });
}

/** লেখার কার্যকর সম্পাদনা-অবস্থা: প্রকাশিত হলে drafts আগে, নইলে post। trashed/নেই ⇒ null */
export async function currentEdit(posts: PostRepo, id: string) {
  const post = await posts.get(id);
  if (!post || post.status === "trashed") return null;
  const published = post.status === "published";
  const draft = published ? await posts.getDraft(id) : null;
  const cur = draft ?? post;
  return { published, title: cur.title, body: cur.body, excerpt: cur.excerpt };
}

/** বর্তমান অবস্থার snapshot (প্রকাশ/ম্যানুয়াল)। লেখা নেই/trashed ⇒ null */
export async function snapshotCurrent(
  posts: PostRepo,
  revs: RevisionRepo,
  id: string,
  trigger: RevisionTrigger,
): Promise<RevisionWithId | null> {
  const cur = await currentEdit(posts, id);
  return cur ? snapshotIfChanged(revs, id, cur.body, trigger) : null;
}

type Kv = { get<T>(key: string): Promise<T | undefined>; set(key: string, value: unknown): Promise<void> };

/** সক্রিয় লেখায় সর্বোচ্চ প্রতি ১০ মিনিটে একটা; খালি লেখা বাদ। বানালে true */
export async function maybeIntervalSnapshot(
  getRevs: () => Promise<RevisionRepo>,
  kv: Kv,
  id: string,
  body: string,
  now = Date.now(),
): Promise<boolean> {
  if (bodyWords(body) === 0) return false;
  if (!intervalDue(await kv.get<number>(revisionKey(id)), now)) return false;
  await snapshotIfChanged(await getRevs(), id, body, "interval");
  await kv.set(revisionKey(id), now);
  return true;
}

export type RestoreResult =
  | { kind: "restored"; published: boolean }
  | { kind: "same" }
  | { kind: "unavailable" };

/** আগে বর্তমান অবস্থার snapshot (ব্যর্থ হলে restore হয় না — কিছু হারায় না); তারপর body প্রতিস্থাপন */
export async function restoreRevision(posts: PostRepo, revs: RevisionRepo, revisionId: string): Promise<RestoreResult> {
  const rev = await revs.get(revisionId);
  if (!rev) return { kind: "unavailable" };
  const cur = await currentEdit(posts, rev.targetId);
  if (!cur) return { kind: "unavailable" };
  if (cur.body === rev.snapshot) return { kind: "same" };

  await snapshotIfChanged(revs, rev.targetId, cur.body, "manual");

  // সারাংশ স্বয়ংক্রিয় (body থেকে বানানো) হলে নতুন body থেকে; হাতে লেখা হলে অক্ষত (PostEditor-এর একই নিয়ম)
  const newText = textOf(rev.snapshot);
  const excerpt = cur.excerpt === makeExcerpt(textOf(cur.body)) ? makeExcerpt(newText) : cur.excerpt;
  if (cur.published) {
    await posts.saveEdit(rev.targetId, { title: cur.title, body: rev.snapshot, excerpt });
  } else {
    await posts.update(rev.targetId, { body: rev.snapshot, excerpt, wordCount: countWords(newText) });
  }
  return { kind: "restored", published: cur.published };
}
