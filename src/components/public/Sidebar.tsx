import type { ReactNode } from "react";
import Link from "next/link";
import type { SiteSettings } from "@/data/siteSettingsRepo";
import { bn } from "@/i18n/bn";
import { archiveMonths } from "@/lib/archive";
import { buildDiaryMonth, DIARY_PATH, latestDay } from "@/lib/diaryCalendar";
import { DEFAULT_SIDEBAR, resolveLayout, type SidebarWidget } from "@/lib/layout";
import type { PopularRow } from "@/lib/popular";
import { SEARCH_PATH } from "@/lib/publicSearch";
import type { Scope } from "@/lib/publicLists";
import { FEED_PATH } from "@/lib/rss";
import type { PublicDiary } from "@/data/publicDiary";
import { AuthorBox } from "./AuthorBox";
import { DiaryCalendar } from "./DiaryCalendar";
import { DiaryEntries } from "./DiaryEntries";

const RECENT_COUNT = 5;
const box = "rounded-2xl border border-line bg-surface p-4";
const row = "inline-flex min-h-11 w-full items-center justify-between gap-2";
const cta = "inline-flex min-h-11 items-center rounded-full bg-btn-bg px-4 font-semibold text-btn-tx";
const ghost = "inline-flex min-h-11 items-center rounded-full border border-line px-4";
const ext = { rel: "noopener noreferrer", target: "_blank" } as const;

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={box}>
      <h2 className="mb-2 font-serif text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** একটা widget; দেখানোর মতো কিছু না থাকলে null (খালি ফেসবুক/লিংক/ক্যাটাগরি লুকানো — Mockup §৫) */
function widget(id: SidebarWidget, s: SiteSettings, scopes: readonly Scope[], popular: readonly PopularRow[], diary?: PublicDiary, custom?: string): ReactNode {
  const ti = (d: string) => custom || d; // owner-দেওয়া নাম থাকলে সেটা
  const blogCards = () => scopes.find((x) => x.kind === "blog")?.cards ?? [];
  switch (id) {
    case "search":
      // JS ছাড়াই চলা GET ফর্ম → /search?q= (header-এর মতোই)
      // <760px-এ লুকানো: header-এ ⌕ আছে
      return (
        <div className="max-[759px]:hidden">
        <Box title={ti(bn.public.searchTitle)}>
          <form action={SEARCH_PATH} method="get" className="flex items-center gap-1">
            <input type="search" name="q" aria-label={bn.publicSearch.headerLabel} placeholder={bn.publicSearch.headerLabel} autoComplete="off" className="min-h-11 w-full min-w-0 rounded-lg border border-line bg-bg px-3 text-base" />
            <button type="submit" aria-label={bn.publicSearch.button} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-bg">
              🔍
            </button>
          </form>
        </Box>
        </div>
      );
    case "archive": {
      // মাস-বাছাই: <details> তালিকা (JS লাগে না) → /archive/[y]/[m]
      const months = archiveMonths(blogCards(), s.timezone);
      return months.length ? (
        <Box title={ti(bn.public.archiveTitle)}>
          <details>
            <summary className="inline-flex min-h-11 w-full cursor-pointer items-center rounded-lg border border-line px-3">{bn.public.archivePick}</summary>
            <ul className="mt-2 max-h-64 overflow-y-auto">
              {months.map((m) => (
                <li key={m.key}>
                  <Link href={m.path} prefetch={false} className={row}>
                    <span>{m.label}</span>
                    <span className="text-sm text-muted">{m.count.toLocaleString("bn-BD")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </Box>
      ) : null;
    }
    case "calendar": {
      // দিনলিপি পঞ্জিকা: সর্বশেষ লেখা-আছে এমন মাস, হিটম্যাপ; দিনে ক্লিক → /diary/তারিখ। দিনলিপি না থাকলে লুকানো
      const last = diary ? latestDay(diary.byDay.keys()) : undefined;
      if (!diary || !last) return null;
      return (
        <Box title={ti(bn.public.calendarTitle)}>
          <DiaryCalendar view={buildDiaryMonth(diary.words, last.slice(0, 7))} timeZone={diary.tz} />
          <DiaryEntries day={last} entries={diary.byDay.get(last) ?? []} preview />
          <Link href={DIARY_PATH} prefetch={false} className="mt-2 inline-flex min-h-11 items-center text-accent-text underline">
            {bn.public.diaryAll} →
          </Link>
        </Box>
      );
    }
    case "facebook":
      return s.socialLinks.facebook ? (
        <Box title={ti(bn.public.facebookTitle)}>
          <p className="mb-3 text-sm text-muted">{bn.public.facebookText}</p>
          <a href={s.socialLinks.facebook} {...ext} className={cta}>
            {bn.public.facebookCta}
          </a>
        </Box>
      ) : null;
    case "category": {
      const cats = scopes.filter((x) => x.kind === "category" && x.term && !x.term.parentCategoryId);
      return cats.length ? (
        <Box title={ti(bn.public.categoriesTitle)}>
          <ul>
            {cats.map((c) => (
              <li key={c.key}>
                <Link href={c.path} prefetch={false} className={row}>
                  <span>{c.term?.name}</span>
                  <span className="text-sm text-muted">{c.cards.length.toLocaleString("bn-BD")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Box>
      ) : null;
    }
    case "links":
      return s.links.length ? (
        <Box title={ti(bn.public.linksTitle)}>
          <ul>
            {s.links.map((l) => (
              <li key={`${l.label}|${l.url}`}>
                <a href={l.url} {...ext} className={row}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </Box>
      ) : null;
    case "follow":
      return (
        <Box title={ti(bn.public.followTitle)}>
          <div className="flex flex-wrap gap-2">
            <a href={FEED_PATH} className={cta}>
              {bn.public.rss}
            </a>
            {s.socialLinks.facebook && (
              <a href={s.socialLinks.facebook} {...ext} className={ghost}>
                {bn.public.followFacebook}
              </a>
            )}
          </div>
        </Box>
      );
    case "recent": {
      const cards = (scopes.find((x) => x.kind === "blog")?.cards ?? []).slice(0, RECENT_COUNT);
      return cards.length ? (
        <Box title={ti(bn.public.recentTitle)}>
          <ul>
            {cards.map((c) => (
              <li key={c.id}>
                <Link href={c.href} prefetch={false} className="block min-h-11 py-2 leading-snug">
                  {c.title || bn.library.untitled}
                  {c.dateLabel && <span className="block text-xs text-muted">{c.dateLabel}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Box>
      ) : null;
    }
    case "popular": {
      // build-সময়ে D1 top-N (শেষ ৩০ দিন); এখনো-published লেখার কার্ড মিলিয়ে। ডেটা না থাকলে (গণনা শুরু হয়নি) লুকানো; ভিউ-সংখ্যা দেখানো হয় না
      const byId = new Map(blogCards().map((c) => [c.id, c] as const));
      const cards = popular.flatMap((p) => byId.get(p.postId) ?? []);
      return cards.length ? (
        <Box title={ti(bn.public.popularTitle)}>
          <ul>
            {cards.map((c) => (
              <li key={c.id}>
                <Link href={c.href} prefetch={false} className="block min-h-11 py-2 leading-snug">
                  {c.title || bn.library.untitled}
                  {c.dateLabel && <span className="block text-xs text-muted">{c.dateLabel}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Box>
      ) : null;
    }
    case "author":
      return s.authorBio.trim() ? <AuthorBox name={s.siteTitle} bio={s.authorBio} compact /> : null;
  }
}

/** `layout.sidebar` অনুযায়ী চালু widget-গুলো; কিছুই না থাকলে null (কলার গ্রিড বানায় না) */
export function sidebarContent(s: SiteSettings, scopes: readonly Scope[], popular: readonly PopularRow[], diary?: PublicDiary): ReactNode {
  const blocks = resolveLayout(s.layout.sidebar, DEFAULT_SIDEBAR)
    .filter((w) => w.enabled)
    .flatMap((w) => {
      const b = widget(w.id, s, scopes, popular, diary, w.title);
      return b ? [<div key={w.id}>{b}</div>] : [];
    });
  return blocks.length ? <aside aria-label={bn.public.sidebarLabel} className="space-y-4">{blocks}</aside> : null;
}
