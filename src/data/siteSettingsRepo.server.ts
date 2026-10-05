// পথ খ (build-time public read): unauthenticated Firestore REST + server-key; চলে GitHub Actions build-এ, Worker-এ নয় (Arch §২)।
// rules: siteSettings public-read। doc নেই (404) = DEFAULT_SETTINGS; অন্য ব্যর্থতায় throw → build থামে, বিদ্যমান সাইট অক্ষত।
import { getEnv } from "@/config/env";
import { decodeDocument, type RestDocument } from "@/data/firestoreRest";
import { withRetry } from "@/data/retry";
import {
  DEFAULT_SETTINGS,
  parseSiteSettings,
  type PublicSettingsSource,
  type SiteSettings,
} from "@/data/siteSettingsRepo";
import { SETTINGS_DOC_ID } from "@/lib/siteSettings";

export function createPublicSettingsSource(opts: {
  projectId: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): PublicSettingsSource {
  const f = opts.fetchImpl ?? fetch;
  // key URL-এ — কখনো log/error-বার্তায় যায় না
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    opts.projectId,
  )}/databases/(default)/documents/siteSettings/${SETTINGS_DOC_ID}?key=${encodeURIComponent(opts.apiKey)}`;
  return {
    async read(): Promise<SiteSettings> {
      const res = await withRetry(async (signal) => {
        const r = await f(url, { signal });
        if (r.status !== 404 && !r.ok) throw new Error(`Firestore REST ${r.status}`);
        return r;
      });
      if (res.status === 404) return DEFAULT_SETTINGS;
      return parseSiteSettings(decodeDocument((await res.json()) as RestDocument).data);
    },
  };
}

/** build-script থেকে: env boot-check সহ */
export function getPublicSettingsSource(): PublicSettingsSource {
  const env = getEnv();
  return createPublicSettingsSource({ projectId: env.FIREBASE_PROJECT_ID, apiKey: env.FIREBASE_SERVER_API_KEY });
}
