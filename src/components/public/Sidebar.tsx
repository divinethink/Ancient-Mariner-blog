import type { ReactNode } from "react";
import Link from "next/link";
import type { SiteSettings } from "@/data/siteSettingsRepo";
import { bn } from "@/i18n/bn";
import { DEFAULT_SIDEBAR, resolveLayout, type SidebarWidget } from "@/lib/layout";
import type { Scope } from "@/lib/publicLists";
import { FEED_PATH } from "@/lib/rss";
import { AuthorBox } from "./AuthorBox";

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
function widget(id: SidebarWidget, s: SiteSettings, scopes: readonly Scope[]): ReactNode {
  switch (id) {
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
export function sidebarContent(s: SiteSettings, scopes: readonly Scope[]): ReactNode {
  const blocks = resolveLayout(s.layout.sidebar, DEFAULT_SIDEBAR)
    .filter((w) => w.enabled)
    .flatMap((w) => {
      const b = widget(w.id, s, scopes);
      return b ? [<div key={w.id}>{b}</div>] : [];
    });
  return blocks.length ? <aside aria-label={bn.public.sidebarLabel} className="space-y-4">{blocks}</aside> : null;
}
