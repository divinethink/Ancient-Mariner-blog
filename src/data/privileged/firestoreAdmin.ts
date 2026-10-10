// Privileged Firestore REST (Bearer service-account token; rules bypass) — শুধু Cron-এর সংকীর্ণ কাজের জন্য (Arch §২ পথ গ)।
// ক্ষমতা ইচ্ছাকৃতভাবে সীমিত: query, batchGet, delete-commit। কোনো generic write নেই। শুধু `src/cron/**` থেকে import।
import { decodeDocument, type RestDocument } from "../firestoreRest";
import { withRetry } from "../retry";
import type { Comment } from "../commentRepo";
import type { DeleteOp } from "../../lib/prune";

/** Workers Free: ৫০ external subrequest/invocation — আগেই থামি */
export const SUBREQUEST_BUDGET = 45;

export class BudgetExceeded extends Error {
  constructor() {
    super("subrequest budget শেষ");
    this.name = "BudgetExceeded";
  }
}

export function createBudget(max: number = SUBREQUEST_BUDGET) {
  let used = 0;
  return {
    /** প্রতি external fetch-এর আগে; সীমা পেরোলে throw */
    spend() {
      if (used >= max) throw new BudgetExceeded();
      used++;
    },
    get used() {
      return used;
    },
  };
}
export type Budget = ReturnType<typeof createBudget>;

export type QueryDoc = { id: string; updateTime?: string; data: Record<string, unknown> };
export type CommitResult = "ok" | "precondition";

export type AdminDb = {
  /** structuredQuery চালায়; শুধু `select` করা field আসে — snapshot/body কখনো পড়া হয় না */
  runQuery(
    structuredQuery: Record<string, unknown>,
  ): Promise<{ docs: QueryDoc[]; truncatedAt?: number }>;
  /** collection-এর doc-গুলোর অস্তিত্ব + নির্বাচিত field (mask) */
  batchGet(
    collection: string,
    ids: readonly string[],
    fieldPaths: readonly string[],
  ): Promise<{ found: QueryDoc[]; missing: string[] }>;
  /** এক atomic commit-এ শুধু delete; precondition (updateTime) ব্যর্থ হলে "precondition" (retry নয়) */
  commitDeletes(ops: readonly DeleteOp[]): Promise<CommitResult>;
  /**
   * scheduled → published (শুধু এই ৪ field: status/publishedAt/updatedAt সেট, scheduledAt মোছা); updateTime precondition।
   * ব্যর্থ হলে "precondition" (owner মাঝে বদলেছে — পরের চালনায় আবার দেখা হবে)
   */
  commitPublish(op: PublishOp): Promise<CommitResult>;
  /**
   * মন্তব্য তৈরি (P11b-১; allowlist ১) — শুধু নতুন doc (`exists:false`), overwrite নয়। একই id আবার এলে "exists" (retry/double-submit-এ duplicate নয়)।
   */
  createComment(op: CommentCreateOp): Promise<"created" | "exists">;
  /**
   * মন্তব্যের status বদল (P11b-২; owner-moderation) — শুধু `status`/`updatedAt` (mask); doc না থাকলে "precondition" (নতুন doc তৈরি হয় না)।
   */
  setCommentStatus(op: { id: string; status: "approved" | "spam"; nowMs: number }): Promise<CommitResult>;
};

export type CommentCreateOp = { id: string; comment: Comment };

export type PublishOp = { id: string; ifUpdateTime: string; publishedAt: Date; nowMs: number };

export function createAdminDb(opts: {
  projectId: string;
  getToken: () => Promise<string>;
  budget: Budget;
  fetchImpl?: typeof fetch;
}): AdminDb {
  const { projectId, getToken, budget, fetchImpl = fetch } = opts;
  const root = `projects/${projectId}/databases/(default)/documents`;
  const base = `https://firestore.googleapis.com/v1/${encodeURI(root)}`;
  const nameOf = (collection: string, id: string) => `${root}/${collection}/${id}`;

  async function post(path: string, body: unknown, signal: AbortSignal): Promise<Response> {
    budget.spend();
    const token = await getToken();
    return fetchImpl(`${base}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  }

  const idOf = (name: string) => name.slice(name.lastIndexOf("/") + 1);
  const toQueryDoc = (d: RestDocument): QueryDoc => {
    const { id, data } = decodeDocument(d);
    return { id, data, updateTime: d.updateTime };
  };

  /** commit-ব্যর্থতার ধরন: precondition = মান ফেরত (retry নয়), বাকি throw */
  const commit = (writes: unknown[]) =>
    withRetry(async (signal): Promise<CommitResult> => {
      const res = await post(":commit", { writes }, signal);
      if (res.ok) return "ok";
      if (res.status === 400 || res.status === 409 || res.status === 404) {
        const j = (await res.json().catch(() => null)) as { error?: { status?: string } } | null;
        const st = j?.error?.status;
        if (st === "FAILED_PRECONDITION" || st === "ABORTED" || st === "NOT_FOUND") return "precondition";
      }
      throw new Error(`Firestore commit ${res.status}`);
    });

  return {
    async createComment({ id, comment: c }) {
      const str = (v: string) => ({ stringValue: v });
      const ts = (d: Date) => ({ timestampValue: d.toISOString() });
      const fields: Record<string, unknown> = {
        postId: str(c.postId),
        authorName: str(c.authorName),
        content: str(c.content),
        status: str(c.status),
        ownerUid: str(c.ownerUid),
        createdAt: ts(c.createdAt),
        updatedAt: ts(c.updatedAt),
        schemaVersion: { integerValue: String(c.schemaVersion) },
        ...(c.parentCommentId ? { parentCommentId: str(c.parentCommentId) } : {}),
        ...(c.byOwner ? { byOwner: { booleanValue: true } } : {}),
      };
      return withRetry(async (signal): Promise<"created" | "exists"> => {
        const res = await post(":commit", { writes: [{ update: { name: nameOf("comments", id), fields }, currentDocument: { exists: false } }] }, signal);
        if (res.ok) return "created";
        if (res.status === 409 || res.status === 400) {
          const j = (await res.json().catch(() => null)) as { error?: { status?: string } } | null;
          if (j?.error?.status === "ALREADY_EXISTS" || j?.error?.status === "FAILED_PRECONDITION") return "exists";
        }
        throw new Error(`Firestore commit ${res.status}`);
      });
    },

    async setCommentStatus(op) {
      return commit([
        {
          update: {
            name: nameOf("comments", op.id),
            fields: { status: { stringValue: op.status }, updatedAt: { timestampValue: new Date(op.nowMs).toISOString() } },
          },
          updateMask: { fieldPaths: ["status", "updatedAt"] },
          currentDocument: { exists: true },
        },
      ]);
    },

    async commitPublish(op) {
      return commit([
        {
          update: {
            name: nameOf("posts", op.id),
            fields: {
              status: { stringValue: "published" },
              publishedAt: { timestampValue: op.publishedAt.toISOString() },
              updatedAt: { timestampValue: new Date(op.nowMs).toISOString() },
            },
          },
          // mask-এ থাকা কিন্তু fields-এ না-থাকা `scheduledAt` মুছে যায়; বাকি field অক্ষত
          updateMask: { fieldPaths: ["status", "publishedAt", "updatedAt", "scheduledAt"] },
          currentDocument: { updateTime: op.ifUpdateTime },
        },
      ]);
    },

    async runQuery(structuredQuery) {
      const items = await withRetry(async (signal) => {
        const res = await post(":runQuery", { structuredQuery }, signal);
        if (!res.ok) throw new Error(`Firestore runQuery ${res.status}`);
        return (await res.json()) as { document?: RestDocument; error?: { message?: string } }[];
      });
      const docs: QueryDoc[] = [];
      for (const it of items) {
        if (it.error) throw new Error("Firestore runQuery error");
        if (it.document) docs.push(toQueryDoc(it.document));
      }
      const limit = (structuredQuery as { limit?: number }).limit;
      return { docs, truncatedAt: limit !== undefined && docs.length >= limit ? limit : undefined };
    },

    async batchGet(collection, ids, fieldPaths) {
      if (ids.length === 0) return { found: [], missing: [] };
      const items = await withRetry(async (signal) => {
        const res = await post(
          ":batchGet",
          { documents: ids.map((id) => nameOf(collection, id)), mask: { fieldPaths } },
          signal,
        );
        if (!res.ok) throw new Error(`Firestore batchGet ${res.status}`);
        return (await res.json()) as { found?: RestDocument; missing?: string }[];
      });
      const found: QueryDoc[] = [];
      const missing: string[] = [];
      for (const it of items) {
        if (it.found) found.push(toQueryDoc(it.found));
        else if (it.missing) missing.push(idOf(it.missing));
      }
      return { found, missing };
    },

    async commitDeletes(ops) {
      if (ops.length === 0) return "ok";
      const writes = ops.map((o) => ({
        delete: nameOf(o.collection, o.id),
        ...(o.ifUpdateTime ? { currentDocument: { updateTime: o.ifUpdateTime } } : {}),
      }));
      // delete idempotent; precondition-ব্যর্থতা throw নয়, মান ফেরত — যাতে retry না হয়
      return withRetry(async (signal): Promise<CommitResult> => {
        const res = await post(":commit", { writes }, signal);
        if (res.ok) return "ok";
        if (res.status === 400 || res.status === 409 || res.status === 404) {
          const j = (await res.json().catch(() => null)) as { error?: { status?: string } } | null;
          const st = j?.error?.status;
          if (st === "FAILED_PRECONDITION" || st === "ABORTED" || st === "NOT_FOUND")
            return "precondition";
        }
        throw new Error(`Firestore commit ${res.status}`);
      });
    },
  };
}
