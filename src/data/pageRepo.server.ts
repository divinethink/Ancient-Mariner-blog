// পথ খ (build-time public read): published pages — unauthenticated Firestore REST + server-key (Arch §২)।
// rules: `status=='published'` ছাড়া পাবলিক read নেই, তাই query-তে explicit filter; কোনো privileged access নেই। চলে GitHub Actions build-এ, Worker-এ নয়।
import { getEnv } from "@/config/env";
import { decodeDocument, publishedPagesQuery, type RestDocument } from "@/data/firestoreRest";
import { parsePage, type PageWithId, type PublicPageSource } from "@/data/pageRepo";
import { withRetry } from "@/data/retry";
import { createLogger } from "@/lib/logger";

type RunQueryItem = { document?: RestDocument; error?: { message?: string } };

export function createPublicPageSource(opts: { projectId: string; apiKey: string; fetchImpl?: typeof fetch }): PublicPageSource {
  const f = opts.fetchImpl ?? fetch;
  const log = createLogger();
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    opts.projectId,
  )}/databases/(default)/documents:runQuery?key=${encodeURIComponent(opts.apiKey)}`;
  return {
    async listPublished(): Promise<PageWithId[]> {
      const items = await withRetry(async (signal) => {
        const res = await f(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(publishedPagesQuery()),
          signal,
        });
        if (!res.ok) throw new Error(`Firestore REST ${res.status}`);
        return (await res.json()) as RunQueryItem[];
      });
      const pages: PageWithId[] = [];
      for (const item of items) {
        if (item.error) throw new Error(`Firestore REST error: ${item.error.message ?? "unknown"}`);
        if (!item.document) continue;
        const { id, data } = decodeDocument(item.document);
        try {
          const p = parsePage(id, data);
          if (p.status === "published") pages.push(p); // defense-in-depth
        } catch {
          log.warn("অবৈধ page বাদ (build)", { id }); // একটা বিকৃত doc যেন পুরো build না থামায়
        }
      }
      return pages;
    },
  };
}

/** build-script থেকে: env boot-check সহ */
export function getPublicPageSource(): PublicPageSource {
  const env = getEnv();
  return createPublicPageSource({ projectId: env.FIREBASE_PROJECT_ID, apiKey: env.FIREBASE_SERVER_API_KEY });
}
