import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorBox } from "@/components/public/AuthorBox";
import { PostArticle } from "@/components/public/PostArticle";
import { ReadingChrome } from "@/components/public/ReadingChrome";
import { SeriesBanner } from "@/components/public/SeriesBanner";
import { PostPager, RelatedPosts } from "@/components/public/PostFooterNav";
import { PublicShell } from "@/components/public/PublicShell";
import { ReaderSize } from "@/components/public/ReaderTools";
import { ViewBeacon } from "@/components/public/ViewBeacon";
import { ShareBar } from "@/components/public/ShareBar";
import { getPublicScopes } from "@/data/publicLists";
import { getSiteUrl } from "@/config/env";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicMedia, getPublicPages, getPublicSettings, listPublicPosts } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { resolveCover } from "@/lib/cards";
import { resolveGallery } from "@/lib/gallery";
import { cldOgUrl } from "@/lib/cloudinary";
import { formatDate } from "@/lib/datetime";
import { pagePath } from "@/lib/pages";
import { blogPath, planSlugMoves, postExcerpt } from "@/lib/publicSite";
import { absoluteUrl } from "@/lib/reader";
import { readingMinutes } from "@/lib/readingTime";
import { adjacentIds, relatedIds, seriesPosition } from "@/lib/related";
import { buildToc } from "@/lib/toc";
import { parseBody } from "@/lib/editorDoc";
import { articleJsonLd, buildSeo, resolvePostSeo } from "@/lib/seo";

// build-সময়ে সব published+public লেখার (এবং বাংলা পুরনো-slug-এর redirect-stub) পেজ; অন্য slug = 404 (Arch §২, §১২)
export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

// Next বাংলা param কখনো encoded দেয়; slug-এ '%' থাকা অসম্ভব, তাই decode idempotent
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

function safeSiteUrl(): string | undefined {
  try {
    return getSiteUrl();
  } catch {
    return undefined; // SITE_URL ছাড়া (লোকাল dev) canonical বাদ
  }
}

async function resolve(rawSlug: string) {
  const slug = decode(rawSlug);
  const posts = await listPublicPosts();
  const post = posts.find((p) => p.slug === slug);
  if (post) return { kind: "post" as const, post };
  const move = planSlugMoves(posts).stubs.find((m) => m.from === slug);
  return move ? { kind: "moved" as const, move } : null;
}

export async function generateStaticParams() {
  const posts = await listPublicPosts();
  return [...posts.map((p) => ({ slug: p.slug })), ...planSlugMoves(posts).stubs.map((m) => ({ slug: m.from }))];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [r, { siteTitle, allowIndexing }, media] = await Promise.all([resolve((await params).slug), getPublicSettings(), getPublicMedia()]);
  if (!r) return {};
  if (r.kind === "post") {
    const cv = resolveCover(r.post.seo?.ogImageId ?? r.post.coverMediaId, media);
    const o = resolvePostSeo(r.post.seo, { title: r.post.title || bn.library.untitled, description: postExcerpt(r.post), siteName: siteTitle });
    return buildSeo({
      siteUrl: safeSiteUrl(),
      siteName: siteTitle,
      title: o.title,
      description: o.description,
      path: blogPath(r.post.slug),
      allowIndexing,
      noindex: o.noindex,
      type: "article",
      publishedTime: r.post.publishedAt,
      modifiedTime: r.post.updatedAt,
      hasOgImage: hasDefaultOgImage(),
      ogImage: cv ? (cldOgUrl(cv.cloud, cv.publicId) ?? undefined) : undefined,
    }) as Metadata;
  }
  let canonical: string | undefined;
  try {
    canonical = `${getSiteUrl()}${blogPath(r.move.to)}`;
  } catch {
    canonical = undefined; // SITE_URL ছাড়া (লোকাল dev) canonical বাদ
  }
  return {
    title: `${bn.public.movedTitle} — ${siteTitle}`,
    alternates: canonical ? { canonical } : undefined,
    robots: { index: false, follow: true },
  };
}

export default async function BlogPost({ params }: Props) {
  const [r, { timezone: tz, siteTitle, authorBio }, pages, media] = await Promise.all([resolve((await params).slug), getPublicSettings(), getPublicPages(), getPublicMedia()]);
  if (!r) notFound();

  if (r.kind === "moved") {
    const to = blogPath(r.move.to);
    return (
      <>
        {/* JS ছাড়া redirect (Arch §২); canonical ও noindex metadata-তে */}
        <meta httpEquiv="refresh" content={`0;url=${to}`} />
        <h1 className="font-serif text-2xl font-bold">{bn.public.movedTitle}</h1>
        <p className="mt-2 text-muted">{bn.public.movedBody}</p>
        <Link href={to} prefetch={false} className="mt-4 inline-flex min-h-11 items-center text-accent-text underline">
          {bn.public.movedLink}
        </Link>
      </>
    );
  }

  const { post } = r;
  // category/tag লিংক scope-ডেটার card থেকে (একই build-ডেটা)
  const blogCards = (await getPublicScopes()).find((s) => s.kind === "blog")?.cards ?? [];
  const card = blogCards.find((c) => c.id === post.id);
  // P10a-৩: সম্পর্কিত ও আগের/পরের — একই build-ডেটা (`publishedAt desc`) থেকে, নতুন query নেই
  const posts = await listPublicPosts();
  const byId = new Map(blogCards.map((c) => [c.id, c] as const));
  const adj = adjacentIds(posts, post.id);
  const related = relatedIds(posts, post.id).flatMap((id) => byId.get(id) ?? []);
  // P10b-১: সূচি (heading ≥৩) ও "পর্ব X/Y" — সিরিজ-scope-এর card-তালিকা (seriesOrder-ক্রমে) থেকে
  const toc = buildToc(parseBody(post.body));
  const seriesScope = post.seriesId ? (await getPublicScopes()).find((s) => s.kind === "series" && s.term?.id === post.seriesId) : undefined;
  const sp = seriesScope ? seriesPosition(seriesScope.cards, post.id) : null;
  const minutes = readingMinutes(post.wordCount);
  const ldCover = resolveCover(post.seo?.ogImageId ?? post.coverMediaId, media);
  const ld = articleJsonLd({
    siteUrl: safeSiteUrl(),
    siteName: siteTitle,
    headline: post.title || bn.library.untitled,
    description: resolvePostSeo(post.seo, { title: post.title, description: postExcerpt(post), siteName: siteTitle }).description,
    path: blogPath(post.slug),
    image: ldCover ? (cldOgUrl(ldCover.cloud, ldCover.publicId) ?? undefined) : undefined,
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
  });
  const meta = (
    <>
      {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt, tz)}</time>}
      {" · "}
      {post.wordCount} {bn.library.words}
      {minutes > 0 && ` · ${bn.public.readMinutes(minutes)}`}
      {post.location && ` · 📍 ${post.location}`}
    </>
  );
  return (
    <PublicShell>
      <ViewBeacon postId={post.id} />
      <ReadingChrome targetId="post-article" title={post.title || bn.library.untitled} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <Link href="/" prefetch={false} className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {bn.public.home}
      </Link>
      {seriesScope && sp && <SeriesBanner name={seriesScope.term!.name} path={seriesScope.path} index={sp.index} total={sp.total} prev={sp.prev} next={sp.next} />}
      <div className="mt-3"><ReaderSize /></div>
      <PostArticle toc={toc} anchors poem={post.contentType === "poetry"} title={post.title} meta={meta} links={card ? [...(card.category ? [card.category] : []), ...card.tags.map((t) => ({ ...t, name: `#${t.name}` }))] : []} body={post.body} cover={card?.cover} gallery={resolveGallery(post.gallery, media)} />
      <ShareBar url={absoluteUrl(safeSiteUrl(), blogPath(post.slug))} />
      <AuthorBox name={siteTitle} bio={authorBio} aboutHref={pages.some((p) => p.slug === "about") ? pagePath("about") : undefined} />
      <PostPager older={adj.older ? byId.get(adj.older) : undefined} newer={adj.newer ? byId.get(adj.newer) : undefined} />
      <RelatedPosts cards={related} />
    </PublicShell>
  );
}
