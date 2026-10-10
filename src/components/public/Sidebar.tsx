import type { ReactNode } from "react";
import Link from "next/link";
import type { SiteSettings } from "@/data/siteSettingsRepo";
import { bn } from "@/i18n/bn";
import { archiveMonths, buildCalendar, type MonthRef } from "@/lib/archive";
import { DEFAULT_SIDEBAR, resolveLayout, type SidebarWidget } from "@/lib/layout";
import { SEARCH_PATH } from "@/lib/publicSearch";
import type { Scope } from "@/lib/publicLists";
import { FEED_PATH } from "@/lib/rss";
import { AuthorBox } from "./AuthorBox";

const RECENT_COUNT = 5;
const box = "rounded-2xl border border-line bg-surface p-4";
const row = "inline-flex min-h-11 w-full items-center justify-between gap-2";
const cta = "inline-flex min-h-11 items-center rounded-full bg-btn-bg px-4 font-semibold text-btn-tx";
const ghost = "inline-flex min-h-11 items-center rounded-full border border-line px-4";
type CalCell = { day: number; href?: string };
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
function widget(id: SidebarWidget, s: SiteSettings, scopes: readonly Scope[], month?: MonthRef): ReactNode {
  const blogCards = () => scopes.find((x) => x.kind === "blog")?.cards ?? [];
  switch (id) {
    case "search":
      // JS ছাড়াই চলা GET ফর্ম → /search?q= (header-এর মতোই)
      return (
        <Box title={bn.public.searchTitle}>
          <form action={SEARCH_PATH} method="get" className="flex items-center gap-1">
            <input type="search" name="q" aria-label={bn.publicSearch.headerLabel} placeholder={bn.publicSearch.headerLabel} autoComplete="off" className="min-h-11 w-full min-w-0 rounded-lg border border-line bg-bg px-3 text-base" />
            <button type="submit" aria-label={bn.publicSearch.button} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-bg">
              🔍
            </button>
          </form>
        </Box>
      );
    case "archive": {
      // মাস-বাছাই: <details> তালিকা (JS লাগে না) → /archive/[y]/[m]
      const months = archiveMonths(blogCards(), s.timezone);
      return months.length ? (
        <Box title={bn.public.archiveTitle}>
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
      // দেখানো মাস = archive পেজে সেই মাস, নইলে সর্বশেষ লেখা-আছে এমন মাস; ‹ › = কাছের লেখা-আছে এমন মাসের static লিংক
      const target = month ?? archiveMonths(blogCards(), s.timezone)[0];
      if (!target) return null;
      const cal = buildCalendar(blogCards(), s.timezone, target.y, target.m);
      const slots: (CalCell | null)[] = [...Array<null>(cal.lead).fill(null), ...cal.cells];
      while (slots.length % 7 !== 0) slots.push(null);
      const weeks = Array.from({ length: slots.length / 7 }, (_, i) => slots.slice(i * 7, i * 7 + 7));
      const nav = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg";
      return (
        <Box title={bn.public.calendarTitle}>
          <div className="mb-1 flex items-center justify-between font-semibold">
            {cal.prev ? (
              <Link href={cal.prev} prefetch={false} aria-label={bn.public.prevMonth} className={nav}>
                ‹
              </Link>
            ) : (
              <span aria-hidden="true" className={`${nav} text-muted`}>
                ‹
              </span>
            )}
            <span>{cal.label}</span>
            {cal.next ? (
              <Link href={cal.next} prefetch={false} aria-label={bn.public.nextMonth} className={nav}>
                ›
              </Link>
            ) : (
              <span aria-hidden="true" className={`${nav} text-muted`}>
                ›
              </span>
            )}
          </div>
          <table className="w-full table-fixed text-center text-sm">
            <caption className="sr-only">{cal.label}</caption>
            <thead>
              <tr>
                {bn.public.weekdays.map((d, i) => (
                  <th key={d} scope="col" abbr={bn.public.weekdaysFull[i]} className="font-medium text-muted">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, wi) => (
                <tr key={wi}>
                  {w.map((c, ci) => (
                    <td key={ci} className="p-0">
                      {c &&
                        (c.href ? (
                          <Link href={c.href} prefetch={false} className="flex min-h-11 items-center justify-center rounded-lg bg-accent/15 font-semibold text-accent-text">
                            {c.day.toLocaleString("bn-BD")}
                          </Link>
                        ) : (
                          <span className="flex min-h-11 items-center justify-center text-muted">{c.day.toLocaleString("bn-BD")}</span>
                        ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      );
    }
    case "facebook":
      return s.socialLinks.facebook ? (
        <Box title={bn.public.facebookTitle}>
          <p className="mb-3 text-sm text-muted">{bn.public.facebookText}</p>
          <a href={s.socialLinks.facebook} {...ext} className={cta}>
            {bn.public.facebookCta}
          </a>
        </Box>
      ) : null;
    case "category": {
      const cats = scopes.filter((x) => x.kind === "category" && x.term && !x.term.parentCategoryId);
      return cats.length ? (
        <Box title={bn.public.categoriesTitle}>
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
        <Box title={bn.public.linksTitle}>
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
        <Box title={bn.public.followTitle}>
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
        <Box title={bn.public.recentTitle}>
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
export function sidebarContent(s: SiteSettings, scopes: readonly Scope[], month?: MonthRef): ReactNode {
  const blocks = resolveLayout(s.layout.sidebar, DEFAULT_SIDEBAR)
    .filter((w) => w.enabled)
    .flatMap((w) => {
      const b = widget(w.id, s, scopes, month);
      return b ? [<div key={w.id}>{b}</div>] : [];
    });
  return blocks.length ? <aside aria-label={bn.public.sidebarLabel} className="space-y-4">{blocks}</aside> : null;
}
