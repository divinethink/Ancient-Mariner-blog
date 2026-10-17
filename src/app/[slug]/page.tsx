import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostBody } from "@/components/public/PostBody";
import { PublicShell } from "@/components/public/PublicShell";
import { getSiteUrl } from "@/config/env";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicMedia, getPublicPages, getPublicSettings } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { collectMediaIds, docToText, makeExcerpt, parseBody } from "@/lib/editorDoc";
import { resolveMediaMap } from "@/lib/gallery";
import { pagePath } from "@/lib/pages";
import { buildSeo } from "@/lib/seo";

// build-সময়ে সব published পেজ (about, privacy, …) `/[slug]`-এ; অন্য slug = 404। static রুট (/blog, /category…) এর আগে মেলে (Arch §১৭ P4b)
export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

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

export async function generateStaticParams() {
  return (await getPublicPages()).map((p) => ({ slug: p.slug }));
}

async function find(raw: string) {
  const slug = decode(raw);
  return (await getPublicPages()).find((p) => p.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [page, { siteTitle, allowIndexing }] = await Promise.all([find((await params).slug), getPublicSettings()]);
  if (!page) return {};
  return buildSeo({
    siteUrl: safeSiteUrl(),
    siteName: siteTitle,
    title: `${page.title || bn.library.untitled} — ${siteTitle}`,
    description: makeExcerpt(docToText(parseBody(page.body))),
    path: pagePath(page.slug),
    allowIndexing,
    type: "website",
    hasOgImage: hasDefaultOgImage(),
  }) as Metadata;
}

export default async function PublicPage({ params }: Props) {
  const page = await find((await params).slug);
  if (!page) notFound();
  const media = resolveMediaMap(collectMediaIds(parseBody(page.body)), await getPublicMedia());
  return (
    <PublicShell>
      <Link href="/" prefetch={false} className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        ← {bn.public.home}
      </Link>
      <article>
        <h1 className="font-serif text-3xl font-bold leading-snug">{page.title || bn.library.untitled}</h1>
        <div className="reading mt-6">
          <PostBody body={page.body} media={media} />
        </div>
      </article>
    </PublicShell>
  );
}
