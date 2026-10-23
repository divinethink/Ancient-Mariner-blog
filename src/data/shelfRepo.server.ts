// পথ খ (build-time public read): `visibility=='public'` বই — unauthenticated Firestore REST + server-key (Arch §২, দিনলিপি-ঘ ধাপ ২)।
// rules-ও একই শর্ত চাপায় (`resource.data.visibility == 'public'`); এখানে query-ও একই filter + পড়ার পর আবার ছাঁকা। চলে GitHub Actions build-এ, Worker-এ নয়।
import { getEnv } from "@/config/env";
import { decodeDocument, publicBooksQuery, type RestDocument } from "@/data/firestoreRest";
import { parseBook, type BookWithId } from "@/data/bookRepo";
import { withRetry } from "@/data/retry";
import { createLogger } from "@/lib/logger";

type RunQueryItem = { document?: RestDocument; error?: { message?: string } };

export interface PublicShelfSource {
  listPublic(): Promise<BookWithId[]>;
}

export function createPublicShelfSource(opts: { projectId: string; apiKey: string; fetchImpl?: typeof fetch }): PublicShelfSource {
  const f = opts.fetchImpl ?? fetch;
  const log = createLogger();
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    opts.projectId,
  )}/databases/(default)/documents:runQuery?key=${encodeURIComponent(opts.apiKey)}`;
  return {
    async listPublic(): Promise<BookWithId[]> {
      const items = await withRetry(async (signal) => {
        const res = await f(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(publicBooksQuery()), signal });
        if (!res.ok) throw new Error(`Firestore REST ${res.status}`);
        return (await res.json()) as RunQueryItem[];
      });
      const out: BookWithId[] = [];
      for (const item of items) {
        if (item.error) throw new Error(`Firestore REST error: ${item.error.message ?? "unknown"}`);
        if (!item.document) continue;
        const { id, data } = decodeDocument(item.document);
        try {
          const b = parseBook(id, data);
          if (b.visibility === "public") out.push(b);
        } catch {
          log.warn("অবৈধ বই বাদ (build)", { id }); // একটা বিকৃত doc যেন পুরো build না থামায়
        }
      }
      return out;
    },
  };
}

/** build-script থেকে: env boot-check সহ */
export function getPublicShelfSource(): PublicShelfSource {
  const env = getEnv();
  return createPublicShelfSource({ projectId: env.FIREBASE_PROJECT_ID, apiKey: env.FIREBASE_SERVER_API_KEY });
}
