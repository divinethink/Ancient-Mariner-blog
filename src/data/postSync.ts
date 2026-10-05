// লোকাল ড্রাফট → Firestore sync-এর একক ধাপ (Arch §১২ autosave নীতি-খ/ঙ)। শুধু `PostRepo` interface দেখে (SDK নয়)।
// draft লেখা = `posts`; প্রকাশিত লেখার সম্পাদনা = `drafts/{id}`। merge নেই — রিমোট বদলে গেলে conflict ফেরত।
import type { Draft, PostRepo, PostWithId } from "@/data/postRepo";
import type { LocalDraft } from "@/data/draftStore";
import { remoteChanged, sameContent } from "@/lib/syncPlan";

export type SyncResult =
  | {
      kind: "synced";
      /** রিমোটের যে `updatedAt` এখন আমার base (post ও drafts-এর বড়টা) */
      baseMs: number;
      status: "draft" | "published";
      /** প্রকাশিত লেখায় অপ্রকাশিত সম্পাদনা (drafts ডক) আছে কিনা */
      hasUnpublished: boolean;
    }
  | { kind: "conflict"; remoteMs: number }
  | { kind: "trashed" };

const ms = (d: Date | undefined) => d?.getTime() ?? 0;

export async function syncLocalDraft(
  repo: PostRepo,
  local: LocalDraft,
  baseMs: number | undefined,
): Promise<SyncResult> {
  const content = { title: local.title, body: local.body, excerpt: local.excerpt };
  const post: PostWithId | null = await repo.get(local.id);

  if (!post) {
    // retry-নিরাপদ: একই id-তে আবার create = বিদ্যমান ফেরত (postRepo.create)
    const created = await repo.create({ id: local.id, ...content, wordCount: local.wordCount });
    return { kind: "synced", baseMs: ms(created.updatedAt), status: "draft", hasUnpublished: false };
  }
  if (post.status === "trashed") return { kind: "trashed" };

  const published = post.status === "published";
  const draft = published ? await repo.getDraft(local.id) : null;
  const remoteMs = Math.max(ms(post.updatedAt), ms(draft?.updatedAt));
  const status = published ? "published" : "draft";
  const remoteContent = draft ?? post;

  // ইতিমধ্যে রিমোটে আছে (যেমন নেটওয়ার্ক-ব্যর্থতার পরে আবার চেষ্টা) — লেখার কিছু নেই, conflict-ও নয়
  if (sameContent(content, remoteContent)) {
    return { kind: "synced", baseMs: remoteMs, status, hasUnpublished: published && !!draft };
  }
  if (remoteChanged(remoteMs, baseMs, local.updatedAt)) return { kind: "conflict", remoteMs };

  if (published) {
    const at = await repo.saveEdit(local.id, content);
    return { kind: "synced", baseMs: Math.max(at.getTime(), ms(post.updatedAt)), status, hasUnpublished: true };
  }
  const at = await repo.update(local.id, { ...content, wordCount: local.wordCount });
  return { kind: "synced", baseMs: at.getTime(), status, hasUnpublished: false };
}

/** editor খোলার সময় রিমোটের বর্তমান অবস্থা: প্রকাশিত হলে চলমান সম্পাদনা (drafts) আগে, নইলে post */
export type RemoteView = {
  post: PostWithId;
  draft: Draft | null;
  /** post ও drafts-এর `updatedAt`-র বড়টা — সেটাই sync-এর base */
  stamp: number;
  title: string;
  body: string;
  excerpt: string;
};
export async function loadRemote(repo: PostRepo, id: string): Promise<RemoteView | null> {
  const post = await repo.get(id);
  if (!post) return null;
  const draft = post.status === "published" ? await repo.getDraft(id) : null;
  const cur = draft ?? post;
  return {
    post,
    draft,
    stamp: Math.max(ms(post.updatedAt), ms(draft?.updatedAt)),
    title: cur.title,
    body: cur.body,
    excerpt: cur.excerpt,
  };
}
