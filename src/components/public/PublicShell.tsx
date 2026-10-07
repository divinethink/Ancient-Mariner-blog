import type { ReactNode } from "react";
import Link from "next/link";
import { Analytics } from "@/components/public/Analytics";
import { sidebarContent } from "@/components/public/Sidebar";
import { getPublicScopes } from "@/data/publicLists";
import { getPublicSettings } from "@/data/publicSnapshot";
import { bn } from "@/i18n/bn";
import { BLOG_INDEX_PATH } from "@/lib/publicSite";
import { FEED_PATH } from "@/lib/rss";

const nav = "inline-flex min-h-11 items-center";

/** পাবলিক পেজের header/footer (Arch §১৭ P4a; default মেনু — সম্পাদনা UI P9a)। শুধু বিদ্যমান পেজের লিংক। */
export async function PublicShell({ children, sidebar = false }: { children: ReactNode; sidebar?: boolean }) {
  const [settings, scopes] = await Promise.all([getPublicSettings(), getPublicScopes()]);
  const side = sidebar ? sidebarContent(settings, scopes) : null;
  const cats = scopes.filter((s) => s.kind === "category" && s.term);
  const top = cats.filter((s) => !s.term?.parentCategoryId);
  const childrenOf = (id: string) => cats.filter((s) => s.term?.parentCategoryId === id);
  // ≥৯০০px-এ sidebar ডানে (root `<main>`-এর max-w-3xl থেকে কেন্দ্রে-বের-করা চওড়া কন্টেইনার); নিচে লেখার তালিকার নিচে stack (Mockup §৫)
  const wrap = side ? "min-[900px]:relative min-[900px]:left-1/2 min-[900px]:w-[min(70rem,calc(100vw-3rem))] min-[900px]:-translate-x-1/2" : "";
  return (
    <div className={wrap}>
      <Analytics />
      <header className="mb-6 border-b border-line pb-2">
        <nav aria-label={bn.public.navLabel} className="flex flex-wrap items-center gap-x-5">
          <Link href="/" prefetch={false} className={`${nav} font-serif text-lg font-bold`}>
            {settings.siteTitle}
          </Link>
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
        <span>© {settings.siteTitle}</span>
        {/* static ফাইল — Next <Link> নয়, সরাসরি <a> (build-seo `rss.xml` লেখে) */}
        <a href={FEED_PATH} className="inline-flex min-h-11 items-center text-accent-text underline">
          {bn.public.rss}
        </a>
      </footer>
    </div>
  );
}
