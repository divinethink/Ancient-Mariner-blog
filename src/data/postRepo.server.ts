// পথ খ (build-time public read): unauthenticated Firestore REST + server-key; চলে GitHub Actions build-এ, Worker-এ নয় (Arch §২)।
// Firestore rules প্রযোজ্য — query-তে explicit status/visibility filter; কোনো privileged access নেই।
import { decodeDocument, publishedPostsQuery, type RestDocument } from "@/data/firestoreRest";
import { parsePost, type PostWithId, type PublicPostSource } from "@/data/postRepo";
import { withRetry } from "@/data/retry";
import { getEnv } from "@/config/env";
import { createLogger } from "@/lib/logger";

type RunQueryItem = { document?: RestDocument; error?: { message?: string } };

export function createPublicPostSource(opts: {
  projectId: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): PublicPostSource {
  const f = opts.fetchImpl ?? fetch;
  const log = createLogger();
  // key URL-এ — কখনো log/error-বার্তায় যায় না
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    opts.projectId,
  )}/databases/(default)/documents:runQuery?key=${encodeURIComponent(opts.apiKey)}`;

  return {
    async listPublished(): Promise<PostWithId[]> {
      const items = await withRetry(async (signal) => {
        const res = await f(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(publishedPostsQuery()),
          signal,
        });
        if (!res.ok) throw new Error(`Firestore REST ${res.status}`);
        return (await res.json()) as RunQueryItem[];
      });

      const posts: PostWithId[] = [];
      for (const item of items) {
        if (item.error) throw new Error(`Firestore REST error: ${item.error.message ?? "unknown"}`);
        if (!item.document) continue; // খালি ফলে শুধু readTime আসে
        const { id, data } = decodeDocument(item.document);
        try {
          posts.push(parsePost(id, data));
        } catch {
          // একটা বিকৃত doc যেন পুরো build না থামায়; স্পষ্ট warn
          log.warn("অবৈধ post বাদ (build)", { id });
        }
      }
      return posts;
    },
  };
}

/** build-script থেকে: env boot-check সহ */
export function getPublicPostSource(): PublicPostSource {
  const env = getEnv();
  return createPublicPostSource({
    projectId: env.FIREBASE_PROJECT_ID,
    apiKey: env.FIREBASE_SERVER_API_KEY,
  });
}
