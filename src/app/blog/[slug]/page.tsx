import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorBox } from "@/components/public/AuthorBox";
import { PostArticle } from "@/components/public/PostArticle";
import { PublicShell } from "@/components/public/PublicShell";
import { getPublicScopes } from "@/data/publicLists";
import { getSiteUrl } from "@/config/env";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicSettings, listPublicPosts } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { blogPath, planSlugMoves, postExcerpt } from "@/lib/publicSite";
import { readingMinutes } from "@/lib/readingTime";
import { buildSeo } from "@/lib/seo";

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
  const [r, { siteTitle, allowIndexing }] = await Promise.all([resolve((await params).slug), getPublicSettings()]);
  if (!r) return {};
  if (r.kind === "post") {
    return buildSeo({
      siteUrl: safeSiteUrl(),
      siteName: siteTitle,
      title: `${r.post.title || bn.library.untitled} — ${siteTitle}`,
      description: postExcerpt(r.post),
      path: blogPath(r.post.slug),
      allowIndexing,
      type: "article",
      publishedTime: r.post.publishedAt,
      modifiedTime: r.post.updatedAt,
      hasOgImage: hasDefaultOgImage(),
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
  const [r, { timezone: tz, siteTitle, authorBio }] = await Promise.all([resolve((await params).slug), getPublicSettings()]);
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
  const card = (await getPublicScopes()).find((s) => s.kind === "blog")?.cards.find((c) => c.id === post.id);
  const minutes = readingMinutes(post.wordCount);
  const meta = (
    <>
      {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt, tz)}</time>}
      {" · "}
      {post.wordCount} {bn.library.words}
      {minutes > 0 && ` · ${bn.public.readMinutes(minutes)}`}
    </>
  );
  return (
    <PublicShell>
      <Link href="/" prefetch={false} className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {bn.public.home}
      </Link>
      <PostArticle title={post.title} meta={meta} links={card ? [...(card.category ? [card.category] : []), ...card.tags.map((t) => ({ ...t, name: `#${t.name}` }))] : []} body={post.body} />
      <AuthorBox name={siteTitle} bio={authorBio} />
    </PublicShell>
  );
}
