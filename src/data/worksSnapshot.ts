// build-এর `/works`-ডেটা (P14c-১): `scripts/fetch-public-data.ts` লেখে, `/works` পেজগুলো শুধু এই ফাইল পড়ে (commentSnapshot-এর মতো আলাদা ফাইল —
// `posts.json`/Snapshot অপরিবর্তিত)। ফাইল না থাকলে/বিকৃত হলে খালি ⇒ `/works` তালিকা ফাঁকা, সাইট অক্ষত। শুধু published+public রাখা হয়।
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseChapter, parseProject, type ChapterWithId, type WritingProjectWithId } from "./projectRepo";
import { buildWorks, type Work } from "../lib/works";

export const WORKS_PATH = join(".build-data", "works.json");
export type PublicWork = Work<WritingProjectWithId, ChapterWithId>;

export async function writeWorks(projects: readonly WritingProjectWithId[], chapters: readonly ChapterWithId[], path = WORKS_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ projects, chapters }), "utf8");
}

/** বিকৃত এন্ট্রি বাদ; ছাঁকা + ক্রম `buildWorks`-এ */
export async function readWorks(path = WORKS_PATH): Promise<PublicWork[]> {
  let json: { projects?: unknown; chapters?: unknown };
  try {
    json = JSON.parse(await readFile(path, "utf8")) as typeof json;
  } catch {
    return [];
  }
  const ok = <T>(rows: unknown, parse: (id: string, r: Record<string, unknown>) => T): T[] =>
    (Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []).flatMap((r) => {
      try {
        return [parse(String(r.id), r)];
      } catch {
        return [];
      }
    });
  return buildWorks(ok(json.projects, parseProject), ok(json.chapters, parseChapter));
}

let memo: Promise<PublicWork[]> | undefined;
/** Next build-এর পাবলিক পেজের জন্য (প্রতি worker-এ ফাইল একবার পড়ে); ফাইল না থাকলে (dev/CI `next build`) খালি */
export function getPublicWorks(): Promise<PublicWork[]> {
  memo ??= readWorks();
  return memo;
}
