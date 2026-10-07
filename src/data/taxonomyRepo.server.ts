// পথ খ (build-time public read): categories/tags/series — unauthenticated Firestore REST + server-key (Arch §২)।
// rules: এই তিন collection public-read; কোনো privileged access নেই। চলে GitHub Actions build-এ, Worker-এ নয়।
import { getEnv } from "@/config/env";
import { collectionQuery, decodeDocument, type RestDocument } from "@/data/firestoreRest";
import { withRetry } from "@/data/retry";
import {
  parseTerm,
  type PublicTaxonomySource,
  type PublicTerms,
  type TermWithId,
} from "@/data/taxonomyRepo";
import { createLogger } from "@/lib/logger";

type RunQueryItem = { document?: RestDocument; error?: { message?: string } };

export function createPublicTaxonomySource(opts: {
  projectId: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): PublicTaxonomySource {
  const f = opts.fetchImpl ?? fetch;
  const log = createLogger();
  // key URL-এ — কখনো log/error-বার্তায় যায় না
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    opts.projectId,
  )}/databases/(default)/documents:runQuery?key=${encodeURIComponent(opts.apiKey)}`;

  async function listCollection(collectionId: string): Promise<TermWithId[]> {
    const items = await withRetry(async (signal) => {
      const res = await f(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(collectionQuery(collectionId)),
        signal,
      });
      if (!res.ok) throw new Error(`Firestore REST ${res.status}`);
      return (await res.json()) as RunQueryItem[];
    });
    const terms: TermWithId[] = [];
    for (const item of items) {
      if (item.error) throw new Error(`Firestore REST error: ${item.error.message ?? "unknown"}`);
      if (!item.document) continue;
      const { id, data } = decodeDocument(item.document);
      try {
        terms.push(parseTerm(id, data));
      } catch {
        log.warn("অবৈধ term বাদ (build)", { collectionId, id }); // একটা বিকৃত doc যেন পুরো build না থামায়
      }
    }
    return terms;
  }

  return {
    async listAll(): Promise<PublicTerms> {
      const [categories, tags, series] = await Promise.all([
        listCollection("categories"),
        listCollection("tags"),
        listCollection("series"),
      ]);
      return { categories, tags, series };
    },
  };
}

/** build-script থেকে: env boot-check সহ */
export function getPublicTaxonomySource(): PublicTaxonomySource {
  const env = getEnv();
  return createPublicTaxonomySource({ projectId: env.FIREBASE_PROJECT_ID, apiKey: env.FIREBASE_SERVER_API_KEY });
}
