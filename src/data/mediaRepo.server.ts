// পথ খ (build-time public read): cover-ছবির মেটা — unauthenticated Firestore REST + server-key (Arch §২)।
// rules: `media/{id}` পাবলিক-read শুধু `visibility=='public'` ⇒ id ধরে আলাদা GET (batchGet-এ একটা private/না-থাকা পুরো কলই ফেলত)।
// 403/404 = সেই cover বাদ (gradient-fallback); আসল নেট/৫xx ত্রুটি = throw, build থামে (নীরবে cover-হীন সাইট নয়)।
import { getEnv } from "@/config/env";
import { decodeDocument, type RestDocument } from "@/data/firestoreRest";
import { parseMedia, toPublicMedia, type PublicMedia } from "@/data/mediaRepo";
import { withRetry } from "@/data/retry";
import { createLogger } from "@/lib/logger";

export type PublicMediaSource = { getMany(ids: readonly string[]): Promise<PublicMedia[]> };

const ID_RE = /^[A-Za-z0-9]{1,40}$/;
const CONCURRENCY = 4;

export function createPublicMediaSource(opts: { projectId: string; apiKey: string; fetchImpl?: typeof fetch }): PublicMediaSource {
  const f = opts.fetchImpl ?? fetch;
  const log = createLogger();
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(opts.projectId)}/databases/(default)/documents/media`;

  async function one(id: string): Promise<PublicMedia | null> {
    if (!ID_RE.test(id)) return null;
    // 403/404 retry-যোগ্য নয় ⇒ throw না করে status ফেরানো (withRetry সব throw-ই আবার চেষ্টা করে)
    const got = await withRetry(async (signal) => {
      const res = await f(`${base}/${id}?key=${encodeURIComponent(opts.apiKey)}`, { signal });
      if (res.status === 403 || res.status === 404) return res.status;
      if (!res.ok) throw new Error(`Firestore REST ${res.status}`);
      return (await res.json()) as RestDocument;
    });
    if (typeof got === "number") {
      log.warn("cover-media পাওয়া যায়নি/পাবলিক নয় (build)", { id, status: got });
      return null;
    }
    try {
      return toPublicMedia(parseMedia(id, decodeDocument(got).data));
    } catch {
      log.warn("অবৈধ media বাদ (build)", { id });
      return null;
    }
  }

  return {
    async getMany(ids) {
      const uniq = [...new Set(ids)];
      const out: (PublicMedia | null)[] = new Array(uniq.length).fill(null);
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, uniq.length) }, async () => {
          for (;;) {
            const i = next++;
            if (i >= uniq.length) return;
            out[i] = await one(uniq[i]);
          }
        }),
      );
      return out.filter((m): m is PublicMedia => m !== null);
    },
  };
}

export function getPublicMediaSource(): PublicMediaSource {
  const env = getEnv();
  return createPublicMediaSource({ projectId: env.FIREBASE_PROJECT_ID, apiKey: env.FIREBASE_SERVER_API_KEY });
}
