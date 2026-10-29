import type { ReactNode } from "react";
import Link from "next/link";
import type { SiteSettings } from "@/data/siteSettingsRepo";
import { bn } from "@/i18n/bn";
import { archiveYears } from "@/lib/archive";
import { lookFromSettings } from "@/lib/diaryLook";
import { buildDiaryMonth, DIARY_PATH, latestDay } from "@/lib/diaryCalendar";
import { DEFAULT_SIDEBAR, resolveLayout, type SidebarWidget } from "@/lib/layout";
import type { PopularRow } from "@/lib/popular";
import type { Scope } from "@/lib/publicLists";
import { FEED_PATH } from "@/lib/rss";
import type { PublicDiary } from "@/data/publicDiary";
import type { BookWithId } from "@/data/bookRepo";
import { publicShelf, SHELF_PATH } from "@/lib/books";
import { AuthorBox } from "./AuthorBox";
import { SubscribeBox } from "./SubscribeBox";
import { DiaryCalendar } from "./DiaryCalendar";
import { DiaryEntries } from "./DiaryEntries";

const RECENT_COUNT = 5;
const box = "rounded-2xl border border-line bg-surface p-4";
const row = "inline-flex min-h-11 w-full items-center justify-between gap-2";
/** তালিকা-widget: সারির মাঝে পাতলা রেখা (শেষ সারি বাদে); রং থিম-টোকেন `line` */
const list = "divide-y divide-line";
const cta = "inline-flex min-h-11 items-center rounded-full bg-btn-bg px-4 font-semibold text-btn-tx";
const ghost = "inline-flex min-h-11 items-center rounded-full border border-line px-4";
const ext = { rel: "noopener noreferrer", target: "_blank" } as const;

const boxHead = "relative pb-2 font-serif text-lg font-bold text-accent-text after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-10 after:rounded-full after:bg-accent";

/** collapsible: শিরোনাম চাপলে পুরো বক্স খোলে/বন্ধ (<details>, JS লাগে না); ডিফল্টে বন্ধ */
function Box({ title, children, collapsible = false }: { title: string; children: ReactNode; collapsible?: boolean }) {
  if (collapsible)
    return (
      <details className={`${box} group`}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
          <h2 className={boxHead}>{title}</h2>
          <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90 motion-reduce:transition-none">›</span>
        </summary>
        <div className="mt-3">{children}</div>
      </details>
    );
  return (
    <section className={box}>
      <h2 className={`${boxHead} mb-3`}>{title}</h2>
      {children}
    </section>
  );
}

/** একটা widget; দেখানোর মতো কিছু না থাকলে null (খালি ফেসবুক/লিংক/ক্যাটাগরি লুকানো — Mockup §৫) */
function widget(id: SidebarWidget, s: SiteSettings, scopes: readonly Scope[], popular: readonly PopularRow[], diary?: PublicDiary, custom?: string, shelf: readonly BookWithId[] = []): ReactNode {
  const ti = (d: string) => custom || d; // owner-দেওয়া নাম থাকলে সেটা
  const blogCards = () => scopes.find((x) => x.kind === "blog")?.cards ?? [];
  switch (id) {
    case "search":
      // header-এর সার্চই একমাত্র সার্চ (ডুপ্লিকেট এড়াতে); id স্কিমায় থাকে — পুরনো সংরক্ষিত layout ভাঙে না
      return null;
    case "archive": {
      // বছরভিত্তিক: বছর (সংখ্যাসহ) চাপলে মাস খোলে — <details>, JS লাগে না → /archive/[y]/[m]
      const years = archiveYears(blogCards(), s.timezone);
      return years.length ? (
        <Box title={ti(bn.public.archiveTitle)} collapsible>
          <div className={list}>
            {years.map((y) => (
              <details key={y.y} className="group">
                <summary className={`${row} cursor-pointer`}>
                  <span>{y.y.toLocaleString("bn-BD", { useGrouping: false })}</span>
                  <span className="inline-flex items-center gap-2 text-sm text-muted">
                    {y.count.toLocaleString("bn-BD")}
                    <span aria-hidden="true" className="transition-transform group-open:rotate-90 motion-reduce:transition-none">›</span>
                  </span>
                </summary>
                <ul className="pb-2 ps-4">
                  {y.months.map((m) => (
                    <li key={m.key}>
                      <Link href={m.path} prefetch={false} className={row}>
                        <span>{m.name}</span>
                        <span className="text-sm text-muted">{m.count.toLocaleString("bn-BD")}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
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
          <DiaryEntries day={last} entries={diary.byDay.get(last) ?? []} preview look={lookFromSettings(s)} />
          <Link href={DIARY_PATH} prefetch={false} className="mt-2 inline-flex min-h-11 items-center text-accent-text underline">
            {bn.public.diaryAll} →
          </Link>
        </Box>
      );
    }
    case "shelf": {
      // এখন যা পড়ছি: শুধু পাবলিক বইয়ের মধ্যে 'পড়ছি' (সর্বোচ্চ ৩); না থাকলে লুকানো
      const reading = publicShelf(shelf).reading.slice(0, 3);
      return reading.length ? (
        <Box title={ti(bn.public.shelfWidgetTitle)}>
          <ul className={list}>
            {reading.map((b) => (
              <li key={b.id} className="py-2 leading-snug">
                {b.title}
                {b.author && <span className="block text-xs text-muted">{bn.public.shelfAuthor(b.author)}</span>}
              </li>
            ))}
          </ul>
          <Link href={SHELF_PATH} prefetch={false} className="mt-2 inline-flex min-h-11 items-center text-accent-text underline">
            {bn.public.shelfAll} →
          </Link>
        </Box>
      ) : null;
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
          <ul className={list}>
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
          <ul className={list}>
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
          {(!hasSubscribe(s) || s.socialLinks.facebook) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {!hasSubscribe(s) && (
              <a href={FEED_PATH} className={cta}>
                {bn.public.rss}
              </a>
            )}
            {s.socialLinks.facebook && (
              <a href={s.socialLinks.facebook} {...ext} className={ghost}>
                {bn.public.followFacebook}
              </a>
            )}
          </div>
          )}
          <SubscribeBox action={s.subscribeUrl} link={s.subscribeLink} id="side" />
        </Box>
      );
    case "recent": {
      const cards = (scopes.find((x) => x.kind === "blog")?.cards ?? []).slice(0, RECENT_COUNT);
      return cards.length ? (
        <Box title={ti(bn.public.recentTitle)}>
          <ul className={list}>
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
          <ul className={list}>
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

/** ইমেইল-সাবস্ক্রাইব (ফর্ম বা লিংক) চালু কিনা */
export const hasSubscribe = (s: SiteSettings): boolean => !!(s.subscribeUrl || s.subscribeLink);

/** sidebar-এ চালু "follow" widget-এ RSS বোতাম আছে কি — থাকলে footer-এ RSS দ্বিতীয়বার দেখানো হয় না (ইমেইল-সাবস্ক্রাইব চালু থাকলে widget-এ RSS বোতাম নেই, তাই footer-এ থাকে) */
export const hasFollowWidget = (s: SiteSettings): boolean =>
  !hasSubscribe(s) && resolveLayout(s.layout.sidebar, DEFAULT_SIDEBAR).some((w) => w.id === "follow" && w.enabled);

/** `layout.sidebar` অনুযায়ী চালু widget-গুলো; কিছুই না থাকলে null (কলার গ্রিড বানায় না) */
export function sidebarContent(s: SiteSettings, scopes: readonly Scope[], popular: readonly PopularRow[], diary?: PublicDiary, shelf: readonly BookWithId[] = []): ReactNode {
  const blocks = resolveLayout(s.layout.sidebar, DEFAULT_SIDEBAR)
    .filter((w) => w.enabled)
    .flatMap((w) => {
      const b = widget(w.id, s, scopes, popular, diary, w.title, shelf);
      return b ? [<div key={w.id}>{b}</div>] : [];
    });
  return blocks.length ? <aside aria-label={bn.public.sidebarLabel} className="space-y-4">{blocks}</aside> : null;
}
