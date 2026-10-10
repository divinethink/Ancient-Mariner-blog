// Cron-এর (P5a-৩) pure সিদ্ধান্ত-যুক্তি — SDK/UI/network-মুক্ত। কী মোছা হবে তার সংকীর্ণ filter এখানেই; privileged কোড শুধু এর ফল চালায়।
// নীতি: সন্দেহ হলে মোছা নয় (fail-safe)। Arch §৬ Trash, §১৫ Revision retention।
import { REVISION_RETAIN } from "@/lib/revision";
import { TRASH_DAYS } from "@/lib/trash";

const DAY_MS = 24 * 60 * 60 * 1000;

/** এক run-এ সর্বোচ্চ কয়টা trashed লেখা মোছা (Workers Free: subrequest ৫০/invocation) */
export const PURGE_MAX_POSTS = 8;
/** এক run-এ সর্বোচ্চ কয়টা লেখার revision ছাঁটা */
export const PRUNE_MAX_TARGETS = 12;
/** সাম্প্রতিক-সক্রিয় লেখা খোঁজার জানালা (Cron ছুটে গেলেও ধরা পড়ে) */
export const PRUNE_WINDOW_MS = 2 * DAY_MS;
/** এক commit-এ সর্বোচ্চ write (Firestore সীমা ৫০০) */
export const COMMIT_MAX_WRITES = 450;

/** Firestore doc-ID হিসেবে নিরাপদ (path-এ '/' নেই, '.'/'..'/'__x__' নয়); বাংলা slug বৈধ */
export function isSafeDocId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= 1000 &&
    !id.includes("/") &&
    id !== "." &&
    id !== ".." &&
    !/^__.*__$/.test(id)
  );
}

export const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

// ───────── Trash purge ─────────

export type TrashCandidate = {
  id: string;
  status?: unknown;
  trashedAt?: unknown;
  /** Firestore doc-এর updateTime (precondition-এর জন্য) — না থাকলে মোছা নয় */
  updateTime?: string;
  slug?: unknown;
  slugHistory?: unknown;
};

/** শুধু: status==='trashed', বৈধ trashedAt, ≥ ৭ দিন পুরনো, বৈধ id ও updateTime। সবচেয়ে পুরনো আগে, সর্বোচ্চ `max`টা। */
export function selectPurgeable(
  posts: readonly TrashCandidate[],
  nowMs: number,
  max: number = PURGE_MAX_POSTS,
): TrashCandidate[] {
  const cutoff = nowMs - TRASH_DAYS * DAY_MS;
  return posts
    .filter((p) => {
      if (p.status !== "trashed") return false;
      if (!isSafeDocId(p.id) || !p.updateTime) return false;
      if (!(p.trashedAt instanceof Date)) return false;
      const t = p.trashedAt.getTime();
      return Number.isFinite(t) && t <= cutoff;
    })
    .sort((a, b) => (a.trashedAt as Date).getTime() - (b.trashedAt as Date).getTime())
    .slice(0, Math.max(0, max));
}

/** লেখার বর্তমান slug + slugHistory থেকে সম্ভাব্য `slugs` lock-id (নিরাপদ, অনন্য) */
export function slugLockCandidates(p: Pick<TrashCandidate, "slug" | "slugHistory">): string[] {
  const all = [p.slug, ...(Array.isArray(p.slugHistory) ? p.slugHistory : [])];
  return [...new Set(all.filter(isSafeDocId))].slice(0, 100);
}

/** `slugs` doc-এর মধ্যে শুধু সেগুলো যেগুলোর `postId` এই লেখারই (অন্যের lock কখনো নয়) */
export function ownedSlugLocks(
  postId: string,
  docs: readonly { id: string; postId?: unknown }[],
): string[] {
  return docs.filter((d) => d.postId === postId && isSafeDocId(d.id)).map((d) => d.id);
}

export type DeleteOp = {
  collection: "posts" | "slugs" | "drafts" | "revisions" | "comments";
  id: string;
  ifUpdateTime?: string;
};

/**
 * এক লেখার স্থায়ী মোছার commit-chunk। `posts` doc সবসময় সবচেয়ে শেষ chunk-এ, updateTime-precondition-সহ
 * (মোছার মুহূর্তে লেখা পুনরুদ্ধার/বদলালে commit ব্যর্থ ⇒ কিছু মোছা হয় না)। slug-lock ও draft একই chunk-এ — পোস্টের সাথে atomic।
 * revisionsTruncated হলে শুধু revision মোছা (লেখা রাখা; পরের run-এ বাকিটা)।
 */
export function planPurge(input: {
  postId: string;
  postUpdateTime: string | undefined;
  revisionIds: readonly string[];
  slugLockIds: readonly string[];
  revisionsTruncated: boolean;
  maxPerChunk?: number;
}): DeleteOp[][] {
  const max = input.maxPerChunk ?? COMMIT_MAX_WRITES;
  if (!isSafeDocId(input.postId) || !input.postUpdateTime) return [];
  const revs: DeleteOp[] = [...new Set(input.revisionIds)]
    .filter(isSafeDocId)
    .map((id) => ({ collection: "revisions", id }));
  const finals: DeleteOp[] = [
    ...input.slugLockIds.filter(isSafeDocId).map((id): DeleteOp => ({ collection: "slugs", id })),
    { collection: "drafts", id: input.postId },
    { collection: "posts", id: input.postId, ifUpdateTime: input.postUpdateTime },
  ];
  if (input.revisionsTruncated) return chunk(revs, max);
  if (revs.length + finals.length <= max) return [[...revs, ...finals]];
  if (finals.length > max) return []; // অসম্ভব আকার — মোছা নয়
  return [...chunk(revs, max), finals];
}

// ───────── Revision prune ─────────

export type RevisionStub = {
  id: string;
  targetType?: unknown;
  targetId?: unknown;
  versionNumber?: unknown;
};

/** সাম্প্রতিক revision থেকে বিশিষ্ট post-target-id (নিরাপদ id, সর্বোচ্চ `max`; `pick` দিয়ে শাফল করা যায়) */
export function candidateTargets(
  recent: readonly RevisionStub[],
  max: number = PRUNE_MAX_TARGETS,
  shuffle: <T>(a: T[]) => T[] = (a) => a,
): string[] {
  const set = new Set<string>();
  for (const r of recent)
    if (r.targetType === "post" && isSafeDocId(r.targetId)) set.add(r.targetId);
  return shuffle([...set]).slice(0, Math.max(0, max));
}

/**
 * একটা লেখার revision-তালিকা (যেকোনো ক্রমে) থেকে মোছার id: সর্বশেষ `keep`টা (versionNumber অনুযায়ী) রেখে বাকি।
 * keep=0 ⇒ orphan (লেখা নেই) — সবই। অন্য target/type বা অবৈধ versionNumber (keep>0 হলে) কখনো মোছা নয়।
 */
export function planRevisionPrune(
  revs: readonly RevisionStub[],
  targetId: string,
  keep: number = REVISION_RETAIN,
): string[] {
  const mine = revs.filter(
    (r) => r.targetType === "post" && r.targetId === targetId && isSafeDocId(r.id),
  );
  if (keep <= 0) return mine.map((r) => r.id);
  const ranked = mine
    .filter(
      (r) =>
        typeof r.versionNumber === "number" &&
        Number.isInteger(r.versionNumber) &&
        r.versionNumber >= 1,
    )
    .sort((a, b) => (b.versionNumber as number) - (a.versionNumber as number));
  return ranked.slice(keep).map((r) => r.id);
}
