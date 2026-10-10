import type { ReactNode } from "react";
import Link from "next/link";
import { Analytics } from "@/components/public/Analytics";
import { sidebarContent } from "@/components/public/Sidebar";
import { getPublicScopes } from "@/data/publicLists";
import { getPublicMedia, getPublicPages, getPublicSettings } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { resolveCover } from "@/lib/cards";
import { cldUrl } from "@/lib/cloudinary";
import { resolveFooter, resolveMenu, type ResolvedLink } from "@/lib/menu";
import { pagePath } from "@/lib/pages";
import { BLOG_INDEX_PATH } from "@/lib/publicSite";
import { SEARCH_PATH } from "@/lib/publicSearch";
import { FEED_PATH } from "@/lib/rss";

const nav = "inline-flex min-h-11 items-center";
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
export async function PublicShell({ children, sidebar = false }: { children: ReactNode; sidebar?: boolean }) {
  const [settings, scopes, pages, media] = await Promise.all([getPublicSettings(), getPublicScopes(), getPublicPages(), getPublicMedia()]);
  // P9b-২: লোগো (media না পেলে/অবৈধ হলে শুধু সাইটের নাম — আগের মতো)
  const logo = resolveCover(settings.design.logoMediaId || undefined, media);
  const logoSrc = logo ? cldUrl(logo.cloud, logo.publicId, { w: 96 }) : null;
  // default মেনু/footer: শুধু published system পেজের লিংক
  const about = pages.find((p) => p.slug === "about");
  const privacy = pages.find((p) => p.slug === "privacy");
  const side = sidebar ? sidebarContent(settings, scopes) : null;
  const cats = scopes.filter((s) => s.kind === "category" && s.term);
  const top = cats.filter((s) => !s.term?.parentCategoryId);
  const custom = resolveMenu(
    settings.menu,
    { pages, categories: cats.map((s) => ({ id: s.term!.id, path: s.path })) },
    pagePath,
  );
  const foot = resolveFooter(settings.footer, `© ${settings.siteTitle}`);
  const childrenOf = (id: string) => cats.filter((s) => s.term?.parentCategoryId === id);
  // ≥৯০০px-এ sidebar ডানে (root `<main>`-এর max-w-3xl থেকে কেন্দ্রে-বের-করা চওড়া কন্টেইনার); নিচে লেখার তালিকার নিচে stack (Mockup §৫)
  const wrap = side ? "min-[900px]:relative min-[900px]:left-1/2 min-[900px]:w-[min(70rem,calc(100vw-3rem))] min-[900px]:-translate-x-1/2" : "";
  return (
    <div className={wrap}>
      <Analytics />
      <header className="mb-6 border-b border-line pb-2">
        <nav aria-label={bn.public.navLabel} className="flex flex-wrap items-center gap-x-5">
          <Link href="/" prefetch={false} className={`${nav} gap-2 font-serif text-lg font-bold`}>
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
            {settings.siteTitle}
          </Link>
          {custom ? (
            custom.map((l, i) => <NavLink key={`${i}-${l.href}`} l={l} className={nav} />)
          ) : (
            <>
              <Link href="/" prefetch={false} className={nav}>
                {bn.public.home}
              </Link>
              <Link href={BLOG_INDEX_PATH} prefetch={false} className={nav}>
                {bn.public.blog}
              </Link>
              {top.length > 0 && (
                <details className="relative">
                  <summary className={`${nav} cursor-pointer`}>{bn.public.categories} ▾</summary>
                  <ul className="absolute z-10 mt-1 min-w-48 rounded-xl border border-line bg-surface p-2 shadow">
                    {top.map((s) => (
                      <li key={s.key}>
                        <Link href={s.path} prefetch={false} className={nav}>
                          {s.term?.name}
                        </Link>
                        {childrenOf(s.term!.id).length > 0 && (
                          <ul className="ps-4">
                            {childrenOf(s.term!.id).map((c) => (
                              <li key={c.key}>
                                <Link href={c.path} prefetch={false} className={nav}>
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
              {about && (
                <Link href={pagePath(about.slug)} prefetch={false} className={nav}>
                  {about.title}
                </Link>
              )}
            </>
          )}
          {/* JS ছাড়াই চলা GET ফর্ম → /search?q= (P10a-২) */}
          <form role="search" action={SEARCH_PATH} method="get" className="ms-auto flex items-center gap-1">
            <input type="search" name="q" aria-label={bn.publicSearch.headerLabel} placeholder={bn.publicSearch.headerLabel} autoComplete="off" className="min-h-11 w-32 rounded-lg border border-line bg-surface px-3 text-base min-[760px]:w-56" />
            <button type="submit" aria-label={bn.publicSearch.button} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-surface">
              🔍
            </button>
          </form>
        </nav>
      </header>
      {side ? (
        <div className="min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_18.75rem] min-[900px]:gap-10">
          <div>{children}</div>
          <div className="mt-10 min-[900px]:mt-0">{side}</div>
        </div>
      ) : (
        children
      )}
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-x-4 border-t border-line pt-4 text-sm text-muted">
        <span>{foot.text}</span>
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
      </footer>
    </div>
  );
}
