// পথ খ (build-time public read): approved মন্তব্য — unauthenticated Firestore REST + server-key (Arch §২)।
// rules: `status=='approved'` ছাড়া পাবলিক read নেই, তাই query-তে explicit filter। চলে GitHub Actions build-এ, Worker-এ নয়।
import { getEnv } from "@/config/env";
import { approvedCommentsQuery, decodeDocument, type RestDocument } from "@/data/firestoreRest";
import { parseComment } from "@/data/commentRepo";
import { withRetry } from "@/data/retry";
import type { PublicComment } from "@/lib/comments";
import { createLogger } from "@/lib/logger";

type RunQueryItem = { document?: RestDocument; error?: { message?: string } };
export type PublicCommentSource = { listApproved(): Promise<(PublicComment & { postId: string })[]> };

/** rules এখনো deploy না হলে (403) build থামে না — মন্তব্য ছাড়াই সাইট; বাকি ত্রুটিতে throw (পুরনো সাইট অক্ষত থাকে) */
export class CommentsForbidden extends Error {}

export function createPublicCommentSource(opts: { projectId: string; apiKey: string; fetchImpl?: typeof fetch }): PublicCommentSource {
  const f = opts.fetchImpl ?? fetch;
  const log = createLogger();
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(opts.projectId)}/databases/(default)/documents:runQuery?key=${encodeURIComponent(opts.apiKey)}`;
  return {
    async listApproved() {
      const items = await withRetry(async (signal) => {
        const res = await f(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(approvedCommentsQuery()), signal });
        if (res.status === 403) throw new CommentsForbidden("comments read 403 (rules deploy হয়নি?)");
        if (!res.ok) throw new Error(`Firestore REST ${res.status}`);
        return (await res.json()) as RunQueryItem[];
      });
      const out: (PublicComment & { postId: string })[] = [];
      for (const item of items) {
        if (item.error) throw new Error(`Firestore REST error: ${item.error.message ?? "unknown"}`);
        if (!item.document) continue;
        const { id, data } = decodeDocument(item.document);
        try {
          const c = parseComment(id, data);
          if (c.status !== "approved") continue; // defense-in-depth
          out.push({ id, postId: c.postId, authorName: c.authorName, content: c.content, createdAt: c.createdAt, parentCommentId: c.parentCommentId, byOwner: c.byOwner });
        } catch {
          log.warn("অবৈধ comment বাদ (build)", { id }); // একটা বিকৃত doc যেন পুরো build না থামায়
        }
      }
      return out;
    },
  };
}

export function getPublicCommentSource(): PublicCommentSource {
  const env = getEnv();
  return createPublicCommentSource({ projectId: env.FIREBASE_PROJECT_ID, apiKey: env.FIREBASE_SERVER_API_KEY });
}
