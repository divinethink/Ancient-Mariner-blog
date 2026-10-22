// sitemap.xml ও robots.txt → assets-এ সরাসরি (build-redirects.ts-এর ধাঁচ; Worker চলে না)। snapshot থেকে পড়ে — আলাদা Firestore read নেই।
import { mkdir, writeFile } from "node:fs/promises";
import { readSnapshot } from "../src/data/publicSnapshot";
import { getSiteUrl } from "../src/config/env";
import { renderRss } from "../src/lib/rss";
import { pagePath } from "../src/lib/pages";
import { renderRobots, renderSitemap } from "../src/lib/seo";
import { buildPublicSearchIndex, SEARCH_INDEX_PATH } from "../src/lib/publicSearch";
import { PLACES_PATH, placeStats } from "../src/lib/diarySummary";
import { DIARY_FEED_PATH, DIARY_PATH, diaryDayPath, diaryYearPath, diaryYears, groupByDay } from "../src/lib/diaryCalendar";
import { parseBody } from "../src/lib/editorDoc";
import { postExcerpt } from "../src/lib/publicSite";
import { writeCardChunks } from "./cardChunks";
import { readWorks } from "../src/data/worksSnapshot";
import { chapterFeedItems, mergeFeed } from "../src/lib/works";
import { worksPath } from "../src/lib/projects";

const DIR = ".open-next/assets";

/** /works (তালিকা, প্রজেক্ট, অধ্যায়) sitemap-এন্ট্রি — প্রজেক্ট না থাকলে /works নিজেও sitemap-এ নেই */
function worksEntries(works: Awaited<ReturnType<typeof readWorks>>): { path: string; lastmod?: Date }[] {
  if (works.length === 0) return [];
  const latest = (xs: Date[]) => xs.reduce<Date | undefined>((m, d) => (!m || d > m ? d : m), undefined);
  return [
    { path: worksPath(), lastmod: latest(works.map((w) => w.project.updatedAt)) },
    ...works.flatMap((w) => [
      { path: worksPath(w.project.slug), lastmod: latest([w.project.updatedAt, ...w.chapters.map((c) => c.updatedAt)]) },
      ...w.chapters.map((c) => ({ path: worksPath(w.project.slug, c.slug), lastmod: c.updatedAt })),
    ]),
  ];
}

/** দিনলিপি-পঞ্জিকা: /diary ও লেখা-আছে এমন প্রতিটি দিন (দিনলিপি না থাকলে কিছু নয়) */
function diaryPaths(snap: NonNullable<Awaited<ReturnType<typeof readSnapshot>>>): string[] {
  const byDay = groupByDay(snap.diary, snap.settings.timezone);
  const days = [...byDay.keys()].sort();
  return days.length ? [DIARY_PATH, ...diaryYears(days).map(diaryYearPath), ...(placeStats(byDay).length ? [PLACES_PATH] : []), ...days.map(diaryDayPath)] : [];
}

async function main() {
  const snap = await readSnapshot();
  if (!snap) throw new Error("build snapshot নেই");
  const siteUrl = getSiteUrl();
  // P14c-২: /works প্রজেক্ট ও অধ্যায় (শুধু published+public; ফাইল না থাকলে খালি) — RSS ও sitemap-এ। /book (Book Mode) duplicate-content বলে sitemap-এ নেই ও noindex
  const { allowIndexing, blockAiCrawlers, siteTitle, tagline, feedItems, feedMode } = snap.settings;
  // P4a-২: [আরও দেখান] card-JSON chunk (assets/data/cards) — package.json অপরিবর্তিত রাখতে এই ধাপেই (build:cf-এ আগে থেকেই চলে)
  const scopes = await writeCardChunks(snap, DIR);
  const works = await readWorks();
  const feedAll = mergeFeed(snap.posts, chapterFeedItems(works));
  // P4b-২: RSS (সবসময় তৈরি — পাঠক/রিডার-অ্যাপের জন্য; ইনডেক্স-টগল শুধু সার্চ-ইঞ্জিন নিয়ন্ত্রণ করে)
  await writeFile(`${DIR}/rss.xml`, renderRss({ siteUrl, title: siteTitle, description: tagline, posts: feedAll, items: feedItems, mode: feedMode }), "utf8");
  // দিনলিপির আলাদা feed (`/diary/feed.xml`) — মূল rss.xml-এ দিনলিপি নেই; দিনলিপি না থাকলে ফাইল লেখা হয় না
  const diaryDays = groupByDay(snap.diary, snap.settings.timezone);
  if (diaryDays.size) {
    const items = [...diaryDays].sort(([a], [b]) => (a < b ? 1 : -1)).flatMap(([day, es]) => {
      const p = snap.diary.find((x) => x.id === es[0].id)!;
      return [{ slug: day, title: p.title || day, excerpt: p.excerpt, body: JSON.stringify({ type: "doc", content: es.flatMap((e) => parseBody(e.body).content ?? []) }), publishedAt: p.publishedAt, updatedAt: p.updatedAt, path: diaryDayPath(day) }];
    });
    await mkdir(`${DIR}/diary`, { recursive: true });
    await writeFile(`${DIR}${DIARY_FEED_PATH}`, renderRss({ siteUrl, title: `${siteTitle} — দিনলিপি`, description: tagline, posts: items, items: feedItems, mode: feedMode, feedPath: DIARY_FEED_PATH }), "utf8");
  }
  // P10a-২: পাবলিক খোঁজের index (সবসময়; ইনডেক্স-টগল শুধু সার্চ-ইঞ্জিনের জন্য) — শুধু title/slug/excerpt/category, `body` নয়
  const searchIndex = buildPublicSearchIndex(snap.posts.map((x) => ({ title: x.title, slug: x.slug, excerpt: postExcerpt(x), categoryName: x.categoryName, publishedAt: x.publishedAt })));
  await writeFile(`${DIR}${SEARCH_INDEX_PATH}`, JSON.stringify(searchIndex), "utf8");
  await writeFile(`${DIR}/robots.txt`, renderRobots({ siteUrl, allowIndexing, blockAiCrawlers }), "utf8");
  if (allowIndexing) {
    await writeFile(`${DIR}/sitemap.xml`, renderSitemap(siteUrl, snap.posts, [...scopes.filter((x) => x.kind !== "archive").map((x) => x.path), ...snap.pages.map((pg) => pagePath(pg.slug)), ...diaryPaths(snap)], worksEntries(works)), "utf8");
  }
  console.log(`✅ search-index.json (${searchIndex.items.length} লেখা)`);
  console.log(`✅ rss.xml (${Math.min(feedItems, feedAll.length)} আইটেম (অধ্যায় সহ), ${feedMode}) + robots.txt (ইনডেক্স ${allowIndexing ? "চালু" : "বন্ধ"}, AI-ব্লক ${blockAiCrawlers ? "চালু" : "বন্ধ"})${allowIndexing ? ` + sitemap.xml (${snap.posts.length + snap.pages.length + worksEntries(works).length + 1} URL)` : "; sitemap নেই"}`);
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
