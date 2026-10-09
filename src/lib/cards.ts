// পাবলিক post-card view-model ও [আরও দেখান] chunk (Arch §২ 'Public payload', §১৭ P4a)। pure, SDK/UI-মুক্ত।
// CardView JSON-serializable — build-সময়ে তৈরি হয়ে static পেজ ও `/data/cards/*.json`-এ যায়; `body` কখনো না।
import { cloudFromUrl } from "./cloudinary";
import { formatDate, formatDayMonth } from "./datetime";
import { categoryPath, postExcerpt, blogPath, tagPath } from "./publicSite";
import { readingMinutes } from "./readingTime";

export type CardLink = { name: string; href?: string };
/** cover-ছবির render-তথ্য (Cloudinary public_id + cloud; URL browser-পক্ষে `lib/cloudinary` বানায়) */
export type CoverView = { publicId: string; cloud: string; w?: number; h?: number; alt: string };
/** snapshot-এর public media-র যেটুকু card-এর লাগে */
export type CardMedia = { cloudinaryPublicId: string; cloudinaryUrl: string; width?: number; height?: number; altText?: string };

export type CardView = {
  id: string;
  title: string;
  href: string;
  excerpt: string;
  dateISO?: string;
  dateLabel?: string;
  day?: string;
  month?: string;
  category?: CardLink;
  /** পড়ার সময় (মিনিট); শব্দ না থাকলে ০ */
  minutes: number;
  tags: CardLink[];
  /** cover থাকলে (public ছবি + build-snapshot-এ মেটা); নইলে gradient/অক্ষর fallback */
  cover?: CoverView;
};

export type CardPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  publishedAt?: Date;
  wordCount: number;
  categoryId?: string;
  categoryName?: string;
  tagIds: readonly string[];
  tagNames: readonly string[];
  coverMediaId?: string;
};
export type CardTerm = { id: string; slug: string };
export type CardCtx = {
  timeZone: string;
  categories: ReadonlyMap<string, CardTerm>;
  tags: ReadonlyMap<string, CardTerm>;
  media?: ReadonlyMap<string, CardMedia>;
};

/** cover-id → render-তথ্য; মেটা না থাকলে/URL-এ অন্য host হলে undefined (fallback) */
export function resolveCover(coverMediaId: string | undefined, media: ReadonlyMap<string, CardMedia> | undefined): CoverView | undefined {
  const m = coverMediaId ? media?.get(coverMediaId) : undefined;
  const cloud = m ? cloudFromUrl(m.cloudinaryUrl) : null;
  if (!m || !cloud) return undefined;
  return { publicId: m.cloudinaryPublicId, cloud, ...(m.width && m.height ? { w: m.width, h: m.height } : {}), alt: m.altText ?? "" };
}

export function toCardView(p: CardPost, ctx: CardCtx): CardView {
  const cat = p.categoryId ? ctx.categories.get(p.categoryId) : undefined;
  const category: CardLink | undefined = p.categoryName
    ? { name: p.categoryName, href: cat ? categoryPath(cat.slug) : undefined }
    : undefined;
  const tags: CardLink[] = p.tagIds.flatMap((id, i) => {
    const name = p.tagNames[i];
    if (!name) return [];
    const t = ctx.tags.get(id);
    return [{ name, href: t ? tagPath(t.slug) : undefined }];
  });
  const d = p.publishedAt;
  const cover = resolveCover(p.coverMediaId, ctx.media);
  return {
    id: p.id,
    title: p.title,
    href: blogPath(p.slug),
    excerpt: postExcerpt(p),
    ...(d && { dateISO: d.toISOString(), dateLabel: formatDate(d, ctx.timeZone), ...formatDayMonth(d, ctx.timeZone) }),
    ...(category && { category }),
    minutes: readingMinutes(p.wordCount),
    tags,
    ...(cover && { cover }),
  };
}

/** chunk-ফাইলের নামে শুধু নিরাপদ ASCII key (Firestore auto-id); নইলে সব card প্রথম পেজে — chunk নেই */
export const SAFE_KEY = /^[A-Za-z0-9_-]+$/;
export const cardChunkPath = (key: string, n: number): string => `/data/cards/${key}-${n}.json`;

export type CardPages = { first: CardView[]; chunks: CardView[][] };

/** প্রথম `pageSize`টা সরাসরি, বাকি `pageSize`-এর chunk-এ (chunk-নম্বর ২ থেকে) */
export function splitCards(cards: readonly CardView[], pageSize: number, key: string): CardPages {
  const size = Math.max(1, Math.floor(pageSize));
  if (!SAFE_KEY.test(key)) return { first: [...cards], chunks: [] };
  const chunks: CardView[][] = [];
  for (let i = size; i < cards.length; i += size) chunks.push(cards.slice(i, i + size));
  return { first: cards.slice(0, size), chunks };
}
