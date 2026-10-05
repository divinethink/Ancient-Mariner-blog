import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostBody } from "@/components/public/PostBody";
import { getSiteUrl } from "@/config/env";
import { listPublicPosts } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { blogPath, planSlugMoves, postExcerpt } from "@/lib/publicSite";

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
  const r = await resolve((await params).slug);
  if (!r) return {};
  if (r.kind === "post") {
    return {
      title: `${r.post.title || bn.library.untitled} — ${bn.siteName}`,
      description: postExcerpt(r.post) || undefined,
    };
  }
  let canonical: string | undefined;
  try {
    canonical = `${getSiteUrl()}${blogPath(r.move.to)}`;
  } catch {
    canonical = undefined; // SITE_URL ছাড়া (লোকাল dev) canonical বাদ
  }
  return {
    title: `${bn.public.movedTitle} — ${bn.siteName}`,
    alternates: canonical ? { canonical } : undefined,
    robots: { index: false, follow: true },
  };
}

export default async function BlogPost({ params }: Props) {
  const r = await resolve((await params).slug);
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
  return (
    <article>
      <Link href="/" prefetch={false} className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {bn.public.home}
      </Link>
      <h1 className="font-serif text-3xl font-bold leading-snug">{post.title || bn.library.untitled}</h1>
      <p className="mt-2 text-sm text-muted">
        {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>}
        {" · "}
        {post.wordCount} {bn.library.words}
      </p>
      <div className="reading mt-6">
        <PostBody body={post.body} />
      </div>
    </article>
  );
}
