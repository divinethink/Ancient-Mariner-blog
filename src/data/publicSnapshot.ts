// build-এর একবারের Firestore-পড়ার ফল (Arch §২ 'build একবারই সব পড়ে'): `scripts/fetch-public-data.ts` লেখে,
// Next-এর সব পাবলিক পেজ ও `scripts/build-redirects.ts` শুধু এই ফাইল পড়ে — একাধিক worker হলেও Firestore read বাড়ে না।
// শুধু build-সময়ে চলে (Worker runtime-এ নয়); পথ খ-এর অংশ — rules-সম্মত published+public ডেটাই থাকে।
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createLogger } from "../lib/logger";
import { parsePage, type PageWithId } from "./pageRepo";
import { PublicMediaSchema, type PublicMedia } from "./mediaRepo";
import { parsePost, type PostWithId } from "./postRepo";
import { EMPTY_TERMS, parseTerm, type PublicTerms } from "./taxonomyRepo";
import { DEFAULT_SETTINGS, parseSiteSettings, type SiteSettings } from "./siteSettingsRepo";

export const SNAPSHOT_PATH = join(".build-data", "posts.json");

export type Snapshot = {
  fetchedAt: Date;
  posts: PostWithId[];
  /** P11c-১: published+unlisted — শুধু নিজের URL-এ পেজ; posts-এর কোনো তালিকা/সূচি/sitemap-এ নয় */
  unlisted: PostWithId[];
  settings: SiteSettings;
  terms: PublicTerms;
  pages: PageWithId[];
  /** P6-৩ক: cover-এর public ছবি-মেটা (শুধু যেগুলো কোনো published লেখা ব্যবহার করে) */
  media: PublicMedia[];
};

export async function writeSnapshot(
  posts: readonly PostWithId[],
  fetchedAt: Date,
  path = SNAPSHOT_PATH,
  settings: SiteSettings = DEFAULT_SETTINGS,
  terms: PublicTerms = EMPTY_TERMS,
  pages: readonly PageWithId[] = [],
  media: readonly PublicMedia[] = [],
  unlisted: readonly PostWithId[] = [],
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ fetchedAt: fetchedAt.toISOString(), posts, unlisted, settings, terms, pages, media }), "utf8");
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
  const json = JSON.parse(raw) as { fetchedAt?: unknown; posts?: unknown; unlisted?: unknown; settings?: unknown; terms?: unknown; pages?: unknown; media?: unknown };
  if (typeof json.fetchedAt !== "string" || !Array.isArray(json.posts)) {
    throw new Error("build snapshot বিকৃত");
  }
  const posts = (json.posts as Record<string, unknown>[])
    .map((p) => parsePost(String(p.id), p)) // defensive read + ISO→Date
    .filter((p) => p.status === "published" && p.visibility === "public"); // defense-in-depth
  // P11c-১: পুরনো snapshot-এ নেই = খালি; বিকৃত/অন্য-অবস্থা বাদ
  const unlisted = (Array.isArray(json.unlisted) ? (json.unlisted as Record<string, unknown>[]) : []).flatMap((p) => {
    try {
      const x = parsePost(String(p.id), p);
      return x.status === "published" && x.visibility === "unlisted" ? [x] : [];
    } catch {
      return [];
    }
  });
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
  // P4b-১: পুরনো snapshot-এ pages না থাকলে খালি; বিকৃত/অ-published বাদ (defense-in-depth)
  const pages = (Array.isArray(json.pages) ? (json.pages as Record<string, unknown>[]) : []).flatMap((r) => {
    try {
      const pg = parsePage(String(r.slug), r);
      return pg.status === "published" ? [pg] : [];
    } catch {
      return [];
    }
  });
  // P6-৩ক: পুরনো snapshot-এ media না থাকলে খালি; বিকৃত এন্ট্রি বাদ (cover শুধু gradient-fallback-এ যায়, build থামে না)
  const media = (Array.isArray(json.media) ? json.media : []).flatMap((r) => {
    const x = PublicMediaSchema.safeParse(r);
    return x.success ? [x.data] : [];
  });
  return { fetchedAt: new Date(json.fetchedAt), posts, unlisted, settings: parseSiteSettings(json.settings), terms, pages, media };
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

let unlistedMemo: Promise<PostWithId[]> | undefined;

/** P11c-১: unlisted লেখা (snapshot থেকে) — শুধু `blog/[slug]` নিজের পেজ বানাতে; snapshot না থাকলে খালি */
export function listUnlistedPosts(): Promise<PostWithId[]> {
  unlistedMemo ??= readSnapshot().then((s) => s?.unlisted ?? []);
  return unlistedMemo;
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

let pagesMemo: Promise<PageWithId[]> | undefined;

/** Next build-এর পাবলিক পেজগুলোর জন্য published pages (snapshot থেকে); snapshot না থাকলে খালি */
export function getPublicPages(): Promise<PageWithId[]> {
  pagesMemo ??= readSnapshot().then((s) => s?.pages ?? []);
  return pagesMemo;
}

let mediaMemo: Promise<Map<string, PublicMedia>> | undefined;

/** Next build-এর পাবলিক পেজগুলোর জন্য cover-ছবি (id → মেটা; snapshot থেকে); snapshot না থাকলে খালি */
export function getPublicMedia(): Promise<Map<string, PublicMedia>> {
  mediaMemo ??= readSnapshot().then((s) => new Map((s?.media ?? []).map((m) => [m.id, m] as const)));
  return mediaMemo;
}
