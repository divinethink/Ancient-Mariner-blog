// পথ খ (build-time public read): published+public প্রজেক্ট ও তার published+public অধ্যায় — unauthenticated Firestore REST + server-key (Arch §২, P14c-১)।
// rules দুই স্তরেই শর্ত চাপায় (অধ্যায় + তার প্রজেক্ট); এখানে query-ও একই filter + পড়ার পর আবার ছাঁকা (defense-in-depth)। চলে GitHub Actions build-এ, Worker-এ নয়।
import { getEnv } from "@/config/env";
import { decodeDocument, publishedChaptersQuery, publishedProjectsQuery, type RestDocument } from "@/data/firestoreRest";
import { parseChapter, parseProject, type ChapterWithId, type WritingProjectWithId } from "@/data/projectRepo";
import { withRetry } from "@/data/retry";
import { createLogger } from "@/lib/logger";
import { MAX_CHAPTERS_PER_PROJECT } from "@/lib/projects";

type RunQueryItem = { document?: RestDocument; error?: { message?: string } };

export type PublicWorks = { projects: WritingProjectWithId[]; chapters: ChapterWithId[] };
export interface PublicWorksSource {
  listPublic(): Promise<PublicWorks>;
}

export function createPublicWorksSource(opts: { projectId: string; apiKey: string; fetchImpl?: typeof fetch }): PublicWorksSource {
  const f = opts.fetchImpl ?? fetch;
  const log = createLogger();
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    opts.projectId,
  )}/databases/(default)/documents:runQuery?key=${encodeURIComponent(opts.apiKey)}`;

  async function run(body: unknown): Promise<{ id: string; data: Record<string, unknown> }[]> {
    const items = await withRetry(async (signal) => {
      const res = await f(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
      if (!res.ok) throw new Error(`Firestore REST ${res.status}`);
      return (await res.json()) as RunQueryItem[];
    });
    const out: { id: string; data: Record<string, unknown> }[] = [];
    for (const item of items) {
      if (item.error) throw new Error(`Firestore REST error: ${item.error.message ?? "unknown"}`);
      if (item.document) out.push(decodeDocument(item.document));
    }
    return out;
  }

  return {
    async listPublic(): Promise<PublicWorks> {
      const projects: WritingProjectWithId[] = [];
      for (const { id, data } of await run(publishedProjectsQuery())) {
        try {
          const p = parseProject(id, data);
          if (p.status === "published" && p.visibility === "public") projects.push(p);
        } catch {
          log.warn("অবৈধ প্রজেক্ট বাদ (build)", { id }); // একটা বিকৃত doc যেন পুরো build না থামায়
        }
      }
      const chapters: ChapterWithId[] = [];
      for (const p of projects) {
        for (const { id, data } of await run(publishedChaptersQuery(p.id, MAX_CHAPTERS_PER_PROJECT))) {
          try {
            const c = parseChapter(id, data);
            if (c.projectId === p.id && c.status === "published" && c.visibility === "public") chapters.push(c);
          } catch {
            log.warn("অবৈধ অধ্যায় বাদ (build)", { id });
          }
        }
      }
      return { projects, chapters };
    },
  };
}

/** build-script থেকে: env boot-check সহ */
export function getPublicWorksSource(): PublicWorksSource {
  const env = getEnv();
  return createPublicWorksSource({ projectId: env.FIREBASE_PROJECT_ID, apiKey: env.FIREBASE_SERVER_API_KEY });
}
