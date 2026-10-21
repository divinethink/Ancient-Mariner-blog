// নতুন-প্রকাশ তাৎক্ষণিক (A-lite): Worker runtime-এ শুধু ওই একটা published+public লেখা পড়া — unauthenticated Firestore REST + server-key।
// rules প্রযোজ্য (explicit status/visibility filter); কোনো privileged access নেই, কোনো লেখা নেই। অনুপস্থিত/অনুপযুক্ত = null।
import { decodeDocument, type RestDocument } from "@/data/firestoreRest";
import { createPublicMediaSource } from "@/data/mediaRepo.server";
import { parsePost } from "@/data/postRepo";
import { resolveCover, type CardMedia, type CoverView } from "@/lib/cards";
import { mediaIdsOf, resolveGallery, resolveMediaMap } from "@/lib/gallery";
import { collectMediaIds, parseBody } from "@/lib/editorDoc";

/** পাঠকের জন্য যতটুকু লাগে — পাবলিক পেজে যা দেখা যায় তার বাইরে কিছু নয় */
export type LivePost = {
  slug: string;
  title: string;
  body: string;
  publishedAt: string | null;
  wordCount: number;
  location?: string;
  poem: boolean;
  categoryName?: string;
  cover?: CoverView;
  gallery: CoverView[];
  media: Record<string, CoverView>;
};

const MAX_SLUG = 200;

/** URL-এর slug (percent-encoded হতে পারে) → যাচাই-করা slug বা null */
export function parseLiveSlug(raw: string): string | null {
  let s = raw;
  try {
    s = decodeURIComponent(raw);
  } catch {
    return null;
  }
  // eslint-disable-next-line no-control-regex -- control char বাদ দিতে ইচ্ছাকৃত
  if (!s || s.length > MAX_SLUG || /[/\\\u0000-\u001f]/.test(s)) return null;
  return s;
}

export function liveSlugQuery(slug: string) {
  const eq = (field: string, value: string) => ({
    fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } },
  });
  return {
    structuredQuery: {
      from: [{ collectionId: "posts" }],
      where: { compositeFilter: { op: "AND", filters: [eq("status", "published"), eq("visibility", "public"), eq("slug", slug)] } },
      limit: 1,
    },
  };
}

type RunQueryItem = { document?: RestDocument; error?: { message?: string } };

export async function fetchLivePost(opts: { projectId: string; apiKey: string; slug: string; fetchImpl?: typeof fetch }): Promise<LivePost | null> {
  const f = opts.fetchImpl ?? fetch;
  // key URL-এ — কখনো log/error-বার্তায় যায় না
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(opts.projectId)}/databases/(default)/documents:runQuery?key=${encodeURIComponent(opts.apiKey)}`;
  const res = await f(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(liveSlugQuery(opts.slug)) });
  if (!res.ok) throw new Error(`Firestore REST ${res.status}`);
  const items = (await res.json()) as RunQueryItem[];
  const hit = items.find((i) => i.document);
  if (items.some((i) => i.error)) throw new Error("Firestore REST error");
  if (!hit?.document) return null;
  const { id, data } = decodeDocument(hit.document);
  let post;
  try {
    post = parsePost(id, data);
  } catch {
    return null;
  }
  // defense-in-depth; দিনলিপি /diary-র, /blog/-র নয়
  if (post.status !== "published" || post.visibility !== "public" || post.contentType === "diary" || post.slug !== opts.slug) return null;

  const ids = mediaIdsOf([post]);
  const found = ids.length ? await createPublicMediaSource({ projectId: opts.projectId, apiKey: opts.apiKey, fetchImpl: opts.fetchImpl }).getMany(ids) : [];
  const map = new Map<string, CardMedia>(found.map((m) => [m.id, m]));
  const media = resolveMediaMap(collectMediaIds(parseBody(post.body)), map);
  const cover = resolveCover(post.coverMediaId, map, post.coverCrop);
  return {
    slug: post.slug,
    title: post.title,
    body: post.body,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    wordCount: post.wordCount,
    ...(post.location ? { location: post.location } : {}),
    poem: post.contentType === "poetry",
    ...(post.categoryName ? { categoryName: post.categoryName } : {}),
    ...(cover ? { cover } : {}),
    gallery: resolveGallery(post.gallery, map),
    media: Object.fromEntries(media),
  };
}
