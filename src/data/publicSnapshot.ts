// build-এর একবারের Firestore-পড়ার ফল (Arch §২ 'build একবারই সব পড়ে'): `scripts/fetch-public-data.ts` লেখে,
// Next-এর সব পাবলিক পেজ ও `scripts/build-redirects.ts` শুধু এই ফাইল পড়ে — একাধিক worker হলেও Firestore read বাড়ে না।
// শুধু build-সময়ে চলে (Worker runtime-এ নয়); পথ খ-এর অংশ — rules-সম্মত published+public ডেটাই থাকে।
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createLogger } from "../lib/logger";
import { parsePost, type PostWithId } from "./postRepo";
import { EMPTY_TERMS, parseTerm, type PublicTerms } from "./taxonomyRepo";
import { DEFAULT_SETTINGS, parseSiteSettings, type SiteSettings } from "./siteSettingsRepo";

export const SNAPSHOT_PATH = join(".build-data", "posts.json");

export type Snapshot = { fetchedAt: Date; posts: PostWithId[]; settings: SiteSettings; terms: PublicTerms };

export async function writeSnapshot(
  posts: readonly PostWithId[],
  fetchedAt: Date,
  path = SNAPSHOT_PATH,
  settings: SiteSettings = DEFAULT_SETTINGS,
  terms: PublicTerms = EMPTY_TERMS,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ fetchedAt: fetchedAt.toISOString(), posts, settings, terms }), "utf8");
}

/** ফাইল না থাকলে null; থাকা-কিন্তু-বিকৃত হলে throw (নীরবে খালি সাইট নয়) */
export async function readSnapshot(path = SNAPSHOT_PATH): Promise<Snapshot | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (e) {
    if ((e as { code?: string }).code === "ENOENT") return null;
    throw e;
  }
  const json = JSON.parse(raw) as { fetchedAt?: unknown; posts?: unknown; settings?: unknown; terms?: unknown };
  if (typeof json.fetchedAt !== "string" || !Array.isArray(json.posts)) {
    throw new Error("build snapshot বিকৃত");
  }
  const posts = (json.posts as Record<string, unknown>[])
    .map((p) => parsePost(String(p.id), p)) // defensive read + ISO→Date
    .filter((p) => p.status === "published" && p.visibility === "public"); // defense-in-depth
  // পুরনো snapshot-এ settings/terms না থাকলে defaults (defensive read); একটা বিকৃত term পুরো build থামায় না
  const t = (json.terms ?? {}) as Record<string, unknown>;
  const readTerms = (k: string) =>
    (Array.isArray(t[k]) ? (t[k] as Record<string, unknown>[]) : []).flatMap((r) => {
      try {
        return [parseTerm(String(r.id), r)];
      } catch {
        return [];
      }
    });
  const terms: PublicTerms = { categories: readTerms("categories"), tags: readTerms("tags"), series: readTerms("series") };
  return { fetchedAt: new Date(json.fetchedAt), posts, settings: parseSiteSettings(json.settings), terms };
}

let memo: Promise<PostWithId[]> | undefined;

/** Next build-এর পাবলিক পেজগুলোর জন্য (প্রতি worker-এ একবার পড়ে); snapshot না থাকলে (dev/CI `next build`) খালি */
export function listPublicPosts(): Promise<PostWithId[]> {
  memo ??= readSnapshot().then((s) => {
    if (!s) {
      createLogger().warn("build snapshot নেই — পাবলিক সাইট খালি (build:cf-এ fetch-public-data আগে চলে)");
      return [];
    }
    return s.posts;
  });
  return memo;
}

let settingsMemo: Promise<SiteSettings> | undefined;

/** Next build-এর পাবলিক পেজগুলোর জন্য সাইট-সেটিং (snapshot থেকে); snapshot না থাকলে defaults */
export function getPublicSettings(): Promise<SiteSettings> {
  settingsMemo ??= readSnapshot().then((s) => s?.settings ?? DEFAULT_SETTINGS);
  return settingsMemo;
}

let termsMemo: Promise<PublicTerms> | undefined;

/** Next build-এর পাবলিক পেজগুলোর জন্য category/tag/series (snapshot থেকে); snapshot না থাকলে খালি */
export function getPublicTerms(): Promise<PublicTerms> {
  termsMemo ??= readSnapshot().then((s) => s?.terms ?? EMPTY_TERMS);
  return termsMemo;
}
