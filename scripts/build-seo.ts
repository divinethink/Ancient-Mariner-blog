// sitemap.xml ও robots.txt → assets-এ সরাসরি (build-redirects.ts-এর ধাঁচ; Worker চলে না)। snapshot থেকে পড়ে — আলাদা Firestore read নেই।
import { writeFile } from "node:fs/promises";
import { readSnapshot } from "../src/data/publicSnapshot";
import { getSiteUrl } from "../src/config/env";
import { renderRss } from "../src/lib/rss";
import { pagePath } from "../src/lib/pages";
import { renderRobots, renderSitemap } from "../src/lib/seo";
import { buildPublicSearchIndex, SEARCH_INDEX_PATH } from "../src/lib/publicSearch";
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
  // P10a-২: পাবলিক খোঁজের index (সবসময়; ইনডেক্স-টগল শুধু সার্চ-ইঞ্জিনের জন্য) — শুধু title/slug/excerpt/category, `body` নয়
  const searchIndex = buildPublicSearchIndex(snap.posts.map((x) => ({ title: x.title, slug: x.slug, excerpt: postExcerpt(x), categoryName: x.categoryName, publishedAt: x.publishedAt })));
  await writeFile(`${DIR}${SEARCH_INDEX_PATH}`, JSON.stringify(searchIndex), "utf8");
  await writeFile(`${DIR}/robots.txt`, renderRobots({ siteUrl, allowIndexing, blockAiCrawlers }), "utf8");
  if (allowIndexing) {
    await writeFile(`${DIR}/sitemap.xml`, renderSitemap(siteUrl, snap.posts, [...scopes.filter((x) => x.kind !== "archive").map((x) => x.path), ...snap.pages.map((pg) => pagePath(pg.slug))], worksEntries(works)), "utf8");
  }
  console.log(`✅ search-index.json (${searchIndex.items.length} লেখা)`);
  console.log(`✅ rss.xml (${Math.min(feedItems, feedAll.length)} আইটেম (অধ্যায় সহ), ${feedMode}) + robots.txt (ইনডেক্স ${allowIndexing ? "চালু" : "বন্ধ"}, AI-ব্লক ${blockAiCrawlers ? "চালু" : "বন্ধ"})${allowIndexing ? ` + sitemap.xml (${snap.posts.length + snap.pages.length + worksEntries(works).length + 1} URL)` : "; sitemap নেই"}`);
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
