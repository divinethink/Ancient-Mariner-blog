import type { ReactNode } from "react";
import Link from "next/link";
import { Analytics } from "@/components/public/Analytics";
import { hasFollowWidget, sidebarContent } from "@/components/public/Sidebar";
import { OwnerLink } from "@/components/public/OwnerLink";
import { MobileMenu } from "@/components/public/MobileMenu";
import { SearchBox } from "@/components/public/SearchBox";
import { ThemeToggle } from "@/components/public/ThemeToggle";
import { getPopular } from "@/data/popularSnapshot";
import { getPublicDiary } from "@/data/publicDiary";
import { getPublicScopes } from "@/data/publicLists";
import { getPublicPages, getPublicSettings } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { headFontStyle } from "@/lib/design";
import { resolveFooter, resolveMenu, type ResolvedLink } from "@/lib/menu";
import { DIARY_PATH } from "@/lib/diaryCalendar";
import { pagePath } from "@/lib/pages";
import { BLOG_INDEX_PATH } from "@/lib/publicSite";
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
/** home=true: header = ব্যানার (সবার উপরে) → নাম+স্লোগান (`hero`; মোবাইলে ডানে ☰) → ডেস্কটপে নেভ বার। অন্য পেজে সাইটের নাম + নেভ। ≥৯০০px-এ পুরো সাইট ওয়ার্ডপ্রেসের মতো একটি বক্স-পেজে (ধাপ ১) */
export async function PublicShell({ children, sidebar = false, home = false, banner = null, hero = null }: { children: ReactNode; sidebar?: boolean; home?: boolean; banner?: ReactNode; hero?: ReactNode }) {
  const [settings, scopes, pages, popular, diary] = await Promise.all([getPublicSettings(), getPublicScopes(), getPublicPages(), getPopular(), getPublicDiary()]);
  // default মেনু/footer: শুধু published system পেজের লিংক
  const about = pages.find((p) => p.slug === "about");
  const privacy = pages.find((p) => p.slug === "privacy");
  const side = sidebar ? sidebarContent(settings, scopes, popular, diary) : null;
  const rssInSide = !!side && hasFollowWidget(settings); // sidebar-এ RSS থাকলে footer-এ নয়
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
  // ≥৯০০px: ওয়ার্ডপ্রেসের মতো বক্স-পেজ (surface রঙ + বর্ডার); ছোট পর্দায় আগের মতো
  const sheet = "min-[900px]:rounded-xl min-[900px]:border min-[900px]:border-line min-[900px]:bg-surface";
  return (
    <div className={`${wrap} ${sheet}`}>
      <Analytics />
      {/* feed-reader/ব্রাউজারের স্বয়ংক্রিয় শনাক্তি (React 19 <head>-এ তোলে) */}
      <link rel="alternate" type="application/rss+xml" title={settings.siteTitle} href={FEED_PATH} />
      <header className="zen-hide">
        {home ? (
          <>
            {banner && <div className="mb-4 min-[900px]:mb-0">{banner}</div>}
            {/* নাম+স্লোগান; <760px: বামে নাম, ডানে ☰ */}
            <div className="flex items-start gap-3 min-[900px]:px-8 min-[900px]:pt-6">
              <div className="min-w-0 flex-1 text-start min-[760px]:text-center">{hero}</div>
              <MobileMenu>
                <SearchBox className="flex px-1 pb-1" />
                {links(menuRow)}
                <ThemeToggle inMenu />
              </MobileMenu>
            </div>
            <nav aria-label={bn.public.navLabel} className="mt-4 hidden items-center gap-x-5 border-y border-line bg-bg px-4 min-[760px]:flex min-[900px]:px-8">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5">{links(nav)}</div>
              <div className="flex shrink-0 items-center gap-2">
                <ThemeToggle />
              </div>
            </nav>
          </>
        ) : (
          <nav aria-label={bn.public.navLabel} className="mb-6 flex items-center gap-x-2 border-b border-line pb-2 min-[760px]:gap-x-5 min-[900px]:mb-0 min-[900px]:px-8 min-[900px]:pt-4">
            <Link href="/" prefetch={false} style={headFontStyle(settings.design.titleFont)} className={`${nav} shrink-0 gap-2 font-serif text-lg font-bold`}>
              {settings.siteTitle}
            </Link>
            <div className="hidden min-w-0 items-center gap-x-5 min-[760px]:flex min-[760px]:flex-1 min-[760px]:flex-wrap">{links(nav)}</div>
            <SearchBox className="ms-auto hidden w-44 min-[760px]:flex min-[1100px]:w-56" />
            <div className="hidden shrink-0 items-center gap-2 min-[760px]:flex">
              <ThemeToggle />
            </div>
            <div className="ms-auto min-[760px]:hidden">
              <MobileMenu>
                <SearchBox className="flex px-1 pb-1" />
                {links(menuRow)}
                <ThemeToggle inMenu />
              </MobileMenu>
            </div>
          </nav>
        )}
      </header>
      <div className="min-[900px]:px-8 min-[900px]:pb-6 min-[900px]:pt-6">
      {side ? (
        <div className="min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_18.75rem] min-[900px]:gap-10">
          <div className="min-w-0">{children}</div>
          <div className="mt-10 min-[900px]:mt-0"><SearchBox className="mb-4 hidden min-[760px]:flex" />{side}</div>
        </div>
      ) : (
        <div className="mx-auto max-w-[42rem]">{children}</div>
      )}
      <footer className="zen-hide mt-10 flex flex-col items-center gap-1 border-t border-line pt-4 text-center text-sm text-muted">
        <span>{foot.text}</span>
        <div className="flex flex-wrap items-center justify-center gap-x-5">
        {/* owner-এর ব্রাউজারেই দেখায়; গোপনীয়তা-নীতির বামে */}
        <OwnerLink className={footLink} />
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
        {!rssInSide && (
          <a href={FEED_PATH} className={footLink}>
            {bn.public.rss}
          </a>
        )}
        </div>
      </footer>
      </div>
    </div>
  );
}
