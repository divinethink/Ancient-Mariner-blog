import type { ReactNode } from "react";
import Link from "next/link";
import { Analytics } from "@/components/public/Analytics";
import { sidebarContent } from "@/components/public/Sidebar";
import { OwnerLink } from "@/components/public/OwnerLink";
import { MobileMenu } from "@/components/public/MobileMenu";
import { ThemeToggle } from "@/components/public/ThemeToggle";
import { Icon } from "@/components/icons";
import { getPopular } from "@/data/popularSnapshot";
import { getPublicDiary } from "@/data/publicDiary";
import { getPublicScopes } from "@/data/publicLists";
import { getPublicMedia, getPublicPages, getPublicSettings } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { resolveCover } from "@/lib/cards";
import { headFontStyle } from "@/lib/design";
import { cldUrl } from "@/lib/cloudinary";
import { resolveFooter, resolveMenu, type ResolvedLink } from "@/lib/menu";
import { DIARY_PATH } from "@/lib/diaryCalendar";
import { pagePath } from "@/lib/pages";
import { BLOG_INDEX_PATH } from "@/lib/publicSite";
import { SEARCH_PATH } from "@/lib/publicSearch";
import { FEED_PATH } from "@/lib/rss";

const nav = "inline-flex min-h-11 items-center";
const menuRow = "inline-flex min-h-11 w-full items-center rounded-lg px-2";
const footLink = "inline-flex min-h-11 items-center text-accent-text underline";

/** মেনু/footer-লিংক: ভেতরের পথ = Next Link (prefetch বন্ধ); বাইরের = নতুন ট্যাবে, noopener */
function NavLink({ l, className }: { l: ResolvedLink; className: string }) {
  return l.external ? (
    <a href={l.href} rel="noopener noreferrer" target="_blank" className={className}>
      {l.label}
    </a>
  ) : (
    <Link href={l.href} prefetch={false} className={className}>
      {l.label}
    </Link>
  );
}

/** পাবলিক পেজের header/footer (Arch §১৭ P4a, P9a)। `siteSettings.menu/footer` খালি হলে আগের default; নইলে owner-এর মেনু (draft/মোছা আইটেম লুকানো)। */
/** home=true: নাম হোমপেজে ব্যানারের নিচে দেখানো হয়, তাই header-এ লোগো থাকলে নাম শুধু screen-reader-এর জন্য */
export async function PublicShell({ children, sidebar = false, home = false }: { children: ReactNode; sidebar?: boolean; home?: boolean }) {
  const [settings, scopes, pages, media, popular, diary] = await Promise.all([getPublicSettings(), getPublicScopes(), getPublicPages(), getPublicMedia(), getPopular(), getPublicDiary()]);
  // P9b-২: লোগো (media না পেলে/অবৈধ হলে শুধু সাইটের নাম — আগের মতো)
  const logo = resolveCover(settings.design.logoMediaId || undefined, media);
  const logoSrc = logo ? cldUrl(logo.cloud, logo.publicId, { w: 96 }) : null;
  // default মেনু/footer: শুধু published system পেজের লিংক
  const about = pages.find((p) => p.slug === "about");
  const privacy = pages.find((p) => p.slug === "privacy");
  const side = sidebar ? sidebarContent(settings, scopes, popular, diary) : null;
  const cats = scopes.filter((s) => s.kind === "category" && s.term);
  const top = cats.filter((s) => !s.term?.parentCategoryId);
  const custom = resolveMenu(
    settings.menu,
    { pages, categories: cats.map((s) => ({ id: s.term!.id, path: s.path })) },
    pagePath,
  );
  const foot = resolveFooter(settings.footer, `© ${settings.siteTitle}`);
  const childrenOf = (id: string) => cats.filter((s) => s.term?.parentCategoryId === id);
  // header-মেনু: ≥৭৬০px-এ ইনলাইন, <৭৬০px-এ ☰ মেনুর ভেতরে (একই লিংক-তালিকা)
  const links = (cls: string) =>
    custom ? (
      custom.map((l, i) => <NavLink key={`${i}-${l.href}`} l={l} className={cls} />)
    ) : (
      <>
              <Link href="/" prefetch={false} className={cls}>
                {bn.public.home}
              </Link>
              <Link href={BLOG_INDEX_PATH} prefetch={false} className={cls}>
                {bn.public.blog}
              </Link>
              {top.length > 0 && (
                <details className="relative">
                  <summary className={`${cls} cursor-pointer`}>{bn.public.categories} ▾</summary>
                  <ul className="z-10 min-[760px]:absolute min-[760px]:mt-1 min-[760px]:min-w-48 min-[760px]:rounded-xl min-[760px]:border min-[760px]:border-line min-[760px]:bg-surface min-[760px]:p-2 min-[760px]:shadow">
                    {top.map((s) => (
                      <li key={s.key}>
                        <Link href={s.path} prefetch={false} className={cls}>
                          {s.term?.name}
                        </Link>
                        {childrenOf(s.term!.id).length > 0 && (
                          <ul className="ps-4">
                            {childrenOf(s.term!.id).map((c) => (
                              <li key={c.key}>
                                <Link href={c.path} prefetch={false} className={cls}>
                                  {c.term?.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {diary.byDay.size > 0 && (
                <Link href={DIARY_PATH} prefetch={false} className={cls}>
                  {bn.public.diaryNav}
                </Link>
              )}
              {about && (
                <Link href={pagePath(about.slug)} prefetch={false} className={cls}>
                  {about.title}
                </Link>
              )}
                  </>
    );
  // ≥৯০০px-এ header/footer সব পেজে একই চওড়া কন্টেইনারে (root `<main>`-এর max-w-3xl থেকে বের-করা); sidebar ডানে, নিচে stack (Mockup §৫)।
  // translate নয়, margin দিয়ে কেন্দ্রীকরণ — transform থাকলে ভেতরের `fixed` (ReadingChrome/QuoteShare) ভেঙে যায়। লেখার কলাম সরু থাকে (নিচের children-wrapper)।
  const wrap = "min-[900px]:ml-[calc(50%-min(35rem,calc(50vw-1.5rem)))] min-[900px]:w-[min(70rem,calc(100vw-3rem))]";
  return (
    <div className={wrap}>
      <Analytics />
      <header className="zen-hide mb-6 border-b border-line pb-2">
        <nav aria-label={bn.public.navLabel} className="flex items-center gap-x-2 min-[760px]:gap-x-5">
          <Link href="/" prefetch={false} style={headFontStyle(settings.design.titleFont)} className={`${nav} shrink-0 gap-2 font-serif text-lg font-bold`}>
            {logo && logoSrc && (
              // eslint-disable-next-line @next/next/no-img-element -- Cloudinary-ই optimizer (Arch §১২); alt খালি: পাশেই নাম আছে
              <img
                src={logoSrc}
                alt=""
                height={32}
                {...(logo.w && logo.h ? { width: Math.max(1, Math.round((32 * logo.w) / logo.h)) } : {})}
                className="h-8 w-auto"
              />
            )}
            {home && logo && logoSrc ? <span className="sr-only">{settings.siteTitle}</span> : settings.siteTitle}
          </Link>
          <div className="hidden min-w-0 items-center gap-x-5 min-[760px]:flex min-[760px]:flex-1 min-[760px]:flex-wrap">{links(nav)}</div>
          {/* JS ছাড়াই চলা GET ফর্ম → /search?q= (P10a-২) */}
          <form role="search" action={SEARCH_PATH} method="get" className="ms-auto hidden shrink-0 items-center gap-1 min-[760px]:flex">
            <input type="search" name="q" aria-label={bn.publicSearch.headerLabel} placeholder={bn.publicSearch.headerLabel} autoComplete="off" className="min-h-11 w-32 rounded-lg border border-line bg-surface px-3 text-base min-[900px]:w-40 min-[1100px]:w-56" />
            <button type="submit" aria-label={bn.publicSearch.button} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-surface">
              <Icon name="search" size={20} />
            </button>
          </form>
          <div className="hidden shrink-0 items-center gap-2 min-[760px]:flex">
            <OwnerLink className={nav} />
            <ThemeToggle />
          </div>
          {/* <760px: নাম · ⌕ · ☰ — এক সারি */}
          <Link href={SEARCH_PATH} prefetch={false} aria-label={bn.publicSearch.button} className="ms-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-surface min-[760px]:hidden">
            <Icon name="search" size={20} />
          </Link>
          <MobileMenu>
            {links(menuRow)}
            <ThemeToggle inMenu />
            <OwnerLink className={menuRow} />
          </MobileMenu>
        </nav>
      </header>
      {side ? (
        <div className="min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_18.75rem] min-[900px]:gap-10">
          <div className="min-w-0">{children}</div>
          <div className="mt-10 min-[900px]:mt-0">{side}</div>
        </div>
      ) : (
        <div className="mx-auto max-w-[42rem]">{children}</div>
      )}
      <footer className="zen-hide mt-10 flex flex-col items-center gap-1 border-t border-line pt-4 text-center text-sm text-muted">
        <span>{foot.text}</span>
        <div className="flex flex-wrap items-center justify-center gap-x-5">
        {foot.links ? (
          foot.links.map((l, i) => <NavLink key={`${i}-${l.href}`} l={l} className={footLink} />)
        ) : (
          privacy && (
            <Link href={pagePath(privacy.slug)} prefetch={false} className={footLink}>
              {privacy.title}
            </Link>
          )
        )}
        {/* static ফাইল — Next <Link> নয়, সরাসরি <a> (build-seo `rss.xml` লেখে) */}
        <a href={FEED_PATH} className={footLink}>
          {bn.public.rss}
        </a>
        </div>
      </footer>
    </div>
  );
}
