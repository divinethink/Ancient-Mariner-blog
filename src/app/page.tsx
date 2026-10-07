import type { Metadata } from "next";
import Link from "next/link";
import { PostCardList } from "@/components/public/PostCard";
import { PublicShell } from "@/components/public/PublicShell";
import { getSiteUrl } from "@/config/env";
import { hasDefaultOgImage } from "@/data/publicAssets";
import { getPublicScopes } from "@/data/publicLists";
import { getPublicSettings } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
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
  const [scopes, settings] = await Promise.all([getPublicScopes(), getPublicSettings()]);
  const cards = (scopes.find((s) => s.kind === "blog")?.cards ?? []).slice(0, settings.postsPerPage);
  return (
    <PublicShell>
      <h1 className="font-serif text-3xl font-bold">{settings.siteTitle}</h1>
      {settings.tagline && <p className="mt-1 text-muted">{settings.tagline}</p>}
      <h2 className="mb-4 mt-8 font-serif text-xl font-bold">{bn.public.latest}</h2>
      {cards.length === 0 ? <p className="text-muted">{bn.public.empty}</p> : <PostCardList cards={cards} />}
      {cards.length > 0 && (
        <Link href="/blog" prefetch={false} className="mt-4 inline-flex min-h-11 items-center text-accent-text underline">
          {bn.public.allPosts} →
        </Link>
      )}
    </PublicShell>
  );
}
