import type { Metadata } from "next";
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
import { headFontStyle } from "@/lib/design";
import { splitCards } from "@/lib/cards";
import { LoadMore } from "@/components/public/LoadMore";

// build-সময়ে prerender; পাঠক-রিকোয়েস্টে Worker চলে না (Arch §১২)। card-এ `body` নেই (CardView)।
export const dynamic = "force-static";

const HOME_RECENT = 6; // হোমে প্রথমে ৬টি; বাকি [আরও দেখান]-এ
// নাম/স্লোগানের সাইজ-ক্লাস (পুরো literal — Tailwind স্ক্যান করে); md = আগের চেহারা
const TITLE_SIZE = { sm: "text-2xl min-[640px]:text-3xl", md: "text-3xl min-[640px]:text-4xl", lg: "text-4xl min-[640px]:text-5xl" } as const;
const TAGLINE_SIZE = { sm: "text-sm", md: "text-base", lg: "text-lg" } as const;

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
  const rest = all.filter((c) => c.id !== featured?.id);
  const recent = rest.slice(0, HOME_RECENT);
  // [আরও দেখান]: প্রথম-পেজের বাকি কার্ড নেটওয়ার্ক ছাড়াই, তারপর build-সময়ের chunk (ডুপ্লিকেট বাদ)
  const blogScope = scopes.find((s) => s.kind === "blog");
  const { first, chunks } = splitCards(all, settings.postsPerPage, blogScope?.key ?? "");
  const firstIds = new Set(first.map((c) => c.id));
  const shownIds = recent.map((c) => c.id);
  const initialMore = rest.slice(HOME_RECENT).filter((c) => firstIds.has(c.id));
  const hasMore = !!blogScope && (initialMore.length > 0 || chunks.length > 0);
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
              <h1 style={headFontStyle(settings.design.titleFont)} className={`font-serif font-bold leading-snug ${TITLE_SIZE[settings.design.titleSize]}`}>{settings.siteTitle}</h1>
              {settings.tagline && <p style={headFontStyle(settings.design.taglineFont)} className={`mt-1 text-muted ${TAGLINE_SIZE[settings.design.taglineSize]}`}>{settings.tagline}</p>}
            </section>
          );
        if (id === "featured") return featured ? <section key={id} className="mt-6"><FeaturedCard c={featured} /></section> : null;
        return (
          <section key={id}>
            <h2 className="mb-4 mt-8 font-serif text-xl font-bold">{bn.public.latest}</h2>
            {all.length === 0 ? <p className="text-muted">{bn.public.empty}</p> : recent.length > 0 && <PostCardList cards={recent} />}
            {blogScope && hasMore && <LoadMore scopeKey={blogScope.key} chunks={chunks.length} initial={initialMore} exclude={[...shownIds, ...(featured ? [featured.id] : [])]} />}
          </section>
        );
      })}
    </PublicShell>
  );
}
