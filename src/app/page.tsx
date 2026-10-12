import type { Metadata } from "next";
import Link from "next/link";
import { FeaturedCard } from "@/components/public/FeaturedCard";
import { PostCardList } from "@/components/public/PostCard";
import { PublicShell } from "@/components/public/PublicShell";
import { getSiteUrl } from "@/config/env";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicScopes } from "@/data/publicLists";
import { getPublicMedia, getPublicSettings, listPublicPosts } from "@/data/publicSnapshot";
import { Cover } from "@/components/public/Cover";
import { resolveCover } from "@/lib/cards";
import { bn } from "@/i18n/bn";
import { pickFeatured } from "@/lib/featured";
import { DEFAULT_HOME, resolveLayout } from "@/lib/layout";
import { buildSeo } from "@/lib/seo";

// build-সময়ে prerender; পাঠক-রিকোয়েস্টে Worker চলে না (Arch §১২)। card-এ `body` নেই (CardView)।
export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const { siteTitle, tagline, allowIndexing } = await getPublicSettings();
  let siteUrl: string | undefined;
  try {
    siteUrl = getSiteUrl();
  } catch {
    siteUrl = undefined; // SITE_URL ছাড়া (লোকাল dev) canonical বাদ
  }
  return buildSeo({
    siteUrl,
    siteName: siteTitle,
    title: siteTitle,
    description: tagline,
    path: "/",
    allowIndexing,
    type: "website",
    hasOgImage: hasDefaultOgImage(),
  }) as Metadata;
}

export default async function Home() {
  const [scopes, settings, posts, media] = await Promise.all([getPublicScopes(), getPublicSettings(), listPublicPosts(), getPublicMedia()]);
  const banner = resolveCover(settings.design.bannerMediaId || undefined, media); // P9b-২; না থাকলে/অবৈধ হলে কিছু দেখায় না
  const all = scopes.find((s) => s.kind === "blog")?.cards ?? [];
  const sections = resolveLayout(settings.layout.home, DEFAULT_HOME).filter((x) => x.enabled);
  const featuredId = sections.some((x) => x.id === "featured") ? pickFeatured(posts) : undefined;
  const featured = featuredId ? all.find((c) => c.id === featuredId) : undefined;
  // featured কার্ড recent তালিকায় আবার দেখানো হয় না
  const recent = all.filter((c) => c.id !== featured?.id).slice(0, settings.postsPerPage);
  return (
    <PublicShell sidebar home>
      {banner && (
        <div className="relative mb-6 aspect-[3/1] overflow-hidden rounded-2xl bg-line">
          <Cover cover={banner} sizes="(min-width: 900px) 700px, 100vw" priority />
        </div>
      )}
      {sections.map(({ id }) => {
        if (id === "hero")
          return (
            <section key={id} className="text-center">
              {/* ব্যানার → নাম (h1) → স্লোগান; header-এ নাম আবার আসে না (PublicShell home) */}
              <h1 className="font-serif text-3xl font-bold leading-snug min-[640px]:text-4xl">{settings.siteTitle}</h1>
              {settings.tagline && <p className="mt-1 text-base text-muted">{settings.tagline}</p>}
            </section>
          );
        if (id === "featured") return featured ? <section key={id} className="mt-6"><FeaturedCard c={featured} /></section> : null;
        return (
          <section key={id}>
            <h2 className="mb-4 mt-8 font-serif text-xl font-bold">{bn.public.latest}</h2>
            {all.length === 0 ? <p className="text-muted">{bn.public.empty}</p> : recent.length > 0 && <PostCardList cards={recent} />}
            {all.length > 0 && (
              <Link href="/blog" prefetch={false} className="mt-4 inline-flex min-h-11 items-center text-accent-text underline">
                {bn.public.allPosts} →
              </Link>
            )}
          </section>
        );
      })}
    </PublicShell>
  );
}
