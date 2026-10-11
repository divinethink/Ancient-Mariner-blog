// Privileged allowlist ৩ (Arch §২): Cron — revision prune ও ৭ দিনের trash purge। সংকীর্ণ collection + explicit filter।
// কী মোছা হবে তার সিদ্ধান্ত `lib/prune.ts`-এ (unit-test-করা); এখানে শুধু নির্ধারিত query চালানো ও commit। শুধু `src/cron/**` থেকে import।
import {
  PRUNE_MAX_TARGETS,
  PRUNE_WINDOW_MS,
  PURGE_MAX_POSTS,
  COMMIT_MAX_WRITES,
  candidateTargets,
  chunk,
  ownedSlugLocks,
  planPurge,
  planRevisionPrune,
  selectPurgeable,
  slugLockCandidates,
  type DeleteOp,
  type TrashCandidate,
} from "../../lib/prune";
import { REVISION_RETAIN } from "../../lib/revision";
import type { AdminDb } from "./firestoreAdmin";

type Log = {
  info: (m: string, c?: Record<string, unknown>) => void;
  warn: (m: string, c?: Record<string, unknown>) => void;
};

const fieldEq = (field: string, stringValue: string) => ({
  fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue } },
});
const select = (...paths: string[]) => ({ fields: paths.map((fieldPath) => ({ fieldPath })) });

const TRASH_SCAN_LIMIT = 200;
const REVISION_SCAN_LIMIT = 1000;
const REVISION_LIST_LIMIT = 100;

export type PurgeResult = {
  scanned: number;
  purgedPosts: number;
  deletedRevisions: number;
  skipped: number;
};
export type PruneResult = { targets: number; orphanTargets: number; deletedRevisions: number };

/** ৭ দিনের বেশি trashed লেখা স্থায়ীভাবে মোছে (post + নিজের slug-lock + draft + revisions) */
export async function purgeTrash(db: AdminDb, nowMs: number, log: Log): Promise<PurgeResult> {
  const out: PurgeResult = { scanned: 0, purgedPosts: 0, deletedRevisions: 0, skipped: 0 };

  // শুধু status=='trashed' (single-field index; নতুন index লাগে না) — body কখনো পড়া হয় না (select)
  const { docs } = await db.runQuery({
    from: [{ collectionId: "posts" }],
    where: fieldEq("status", "trashed"),
    select: select("status", "trashedAt", "slug", "slugHistory"),
    limit: TRASH_SCAN_LIMIT,
  });
  out.scanned = docs.length;

  const candidates: TrashCandidate[] = docs.map((d) => ({
    id: d.id,
    updateTime: d.updateTime,
    ...d.data,
  }));
  const due = selectPurgeable(candidates, nowMs, PURGE_MAX_POSTS);
  if (due.length === 0) return out;
  const ids = due.map((p) => p.id);

  // orphan revisions: targetType=='post' && targetId IN [due ids] — truncated হলে লেখা রাখা, শুধু revision মোছা
  const revs = await db.runQuery({
    from: [{ collectionId: "revisions" }],
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          fieldEq("targetType", "post"),
          {
            fieldFilter: {
              field: { fieldPath: "targetId" },
              op: "IN",
              value: { arrayValue: { values: ids.map((stringValue) => ({ stringValue })) } },
            },
          },
        ],
      },
    },
    select: select("targetType", "targetId"),
    limit: REVISION_SCAN_LIMIT,
  });
  const truncated = revs.truncatedAt !== undefined;
  const revIdsByPost = new Map<string, string[]>();
  for (const r of revs.docs) {
    if (r.data.targetType !== "post" || typeof r.data.targetId !== "string") continue;
    if (!ids.includes(r.data.targetId)) continue;
    revIdsByPost.set(r.data.targetId, [...(revIdsByPost.get(r.data.targetId) ?? []), r.id]);
  }

  // slug-lock: শুধু যেগুলোর postId এই লেখারই
  const slugCands = [...new Set(due.flatMap((p) => slugLockCandidates(p)))];
  const slugDocs = await db.batchGet("slugs", slugCands, ["postId"]);
  const slugOwner = slugDocs.found.map((d) => ({ id: d.id, postId: d.data.postId }));

  for (const p of due) {
    const mine = slugLockCandidates(p);
    const owned = ownedSlugLocks(
      p.id,
      slugOwner.filter((s) => mine.includes(s.id)),
    );
    const plan = planPurge({
      postId: p.id,
      postUpdateTime: p.updateTime,
      revisionIds: revIdsByPost.get(p.id) ?? [],
      slugLockIds: owned,
      revisionsTruncated: truncated,
    });
    if (plan.length === 0) {
      out.skipped++;
      continue;
    }
    let aborted = false;
    for (const ops of plan) {
      const res = await db.commitDeletes(ops);
      if (res === "precondition") {
        // মোছার মুহূর্তে লেখাটা বদলেছে (যেমন পুনরুদ্ধার) — কিছু মোছা হয়নি, পরের run-এ আবার দেখা হবে
        log.warn("purge: precondition ব্যর্থ, বাদ", { postId: p.id });
        aborted = true;
        break;
      }
      out.deletedRevisions += ops.filter((o) => o.collection === "revisions").length;
    }
    if (aborted) out.skipped++;
    else if (!truncated) out.purgedPosts++;
    else out.skipped++;
  }
  return out;
}

/** প্রতি সাম্প্রতিক-সক্রিয় লেখায় সর্বশেষ ২০টা রেখে বাকি revision মোছে; লেখা আর নেই (hard-delete) এমন target-এর সব revision মোছে */
export async function pruneRevisions(
  db: AdminDb,
  nowMs: number,
  log: Log,
  shuffle: <T>(a: T[]) => T[] = (a) => a,
): Promise<PruneResult> {
  const out: PruneResult = { targets: 0, orphanTargets: 0, deletedRevisions: 0 };

  const recent = await db.runQuery({
    from: [{ collectionId: "revisions" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "createdAt" },
        op: "GREATER_THAN_OR_EQUAL",
        value: { timestampValue: new Date(nowMs - PRUNE_WINDOW_MS).toISOString() },
      },
    },
    select: select("targetType", "targetId"),
    limit: REVISION_SCAN_LIMIT,
  });
  // post ও chapter আলাদা করে (target-টাইপ অনুযায়ী অস্তিত্ব-collection ও filter) — chapter-এর ইতিহাসও সর্বশেষ ২০টায় ছাঁটা (P14a-৩)
  const stubs = recent.docs.map((d) => ({ id: d.id, ...d.data }));
  let budget = PRUNE_MAX_TARGETS; // দুই টাইপ মিলিয়ে এক run-এ সর্বোচ্চ (Workers Free subrequest-সীমা অপরিবর্তিত)
  for (const type of ["post", "chapter"] as const) {
    const targets = candidateTargets(stubs, budget, shuffle, type);
    if (targets.length === 0) continue;
    budget -= targets.length;

    // অস্তিত্ব: শুধু স্পষ্ট `missing` মানেই orphan (ত্রুটি হলে throw — কিছু মোছা হয় না)
    const owners = await db.batchGet(type === "post" ? "posts" : "chapters", targets, ["status"]);
    const missing = new Set(owners.missing);

    for (const t of targets) {
      const orphan = missing.has(t);
      const { docs } = await db.runQuery({
        from: [{ collectionId: "revisions" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [fieldEq("targetType", type), fieldEq("targetId", t)],
          },
        },
        // composite index: targetType+targetId+versionNumber desc — সর্বশেষগুলো আগে, তাই limit-truncation নিরাপদ
        orderBy: [{ field: { fieldPath: "versionNumber" }, direction: "DESCENDING" }],
        select: select("targetType", "targetId", "versionNumber"),
        limit: REVISION_LIST_LIMIT,
      });
      const del = planRevisionPrune(
        docs.map((d) => ({ id: d.id, ...d.data })),
        t,
        orphan ? 0 : REVISION_RETAIN,
        type,
      );
      if (del.length === 0) continue;
      for (const part of chunk(del, COMMIT_MAX_WRITES)) {
        const ops: DeleteOp[] = part.map((id) => ({ collection: "revisions", id }));
        await db.commitDeletes(ops);
        out.deletedRevisions += ops.length;
      }
      out.targets++;
      if (orphan) out.orphanTargets++;
    }
  }
  log.info("prune সম্পন্ন", { ...out });
  return out;
}
