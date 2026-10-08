// sitemap.xml ও robots.txt → assets-এ সরাসরি (build-redirects.ts-এর ধাঁচ; Worker চলে না)। snapshot থেকে পড়ে — আলাদা Firestore read নেই।
import { writeFile } from "node:fs/promises";
import { readSnapshot } from "../src/data/publicSnapshot";
import { getSiteUrl } from "../src/config/env";
import { renderRss } from "../src/lib/rss";
import { pagePath } from "../src/lib/pages";
import { renderRobots, renderSitemap } from "../src/lib/seo";
import { writeCardChunks } from "./cardChunks";

const DIR = ".open-next/assets";

async function main() {
  const snap = await readSnapshot();
  if (!snap) throw new Error("build snapshot নেই");
  const siteUrl = getSiteUrl();
  const { allowIndexing, blockAiCrawlers, siteTitle, tagline, feedItems, feedMode } = snap.settings;
  // P4a-২: [আরও দেখান] card-JSON chunk (assets/data/cards) — package.json অপরিবর্তিত রাখতে এই ধাপেই (build:cf-এ আগে থেকেই চলে)
  const scopes = await writeCardChunks(snap, DIR);
  // P4b-২: RSS (সবসময় তৈরি — পাঠক/রিডার-অ্যাপের জন্য; ইনডেক্স-টগল শুধু সার্চ-ইঞ্জিন নিয়ন্ত্রণ করে)
  await writeFile(`${DIR}/rss.xml`, renderRss({ siteUrl, title: siteTitle, description: tagline, posts: snap.posts, items: feedItems, mode: feedMode }), "utf8");
  await writeFile(`${DIR}/robots.txt`, renderRobots({ siteUrl, allowIndexing, blockAiCrawlers }), "utf8");
  if (allowIndexing) {
    await writeFile(`${DIR}/sitemap.xml`, renderSitemap(siteUrl, snap.posts, [...scopes.map((x) => x.path), ...snap.pages.map((pg) => pagePath(pg.slug))]), "utf8");
  }
  console.log(`✅ rss.xml (${Math.min(feedItems, snap.posts.length)} লেখা, ${feedMode}) + robots.txt (ইনডেক্স ${allowIndexing ? "চালু" : "বন্ধ"}, AI-ব্লক ${blockAiCrawlers ? "চালু" : "বন্ধ"})${allowIndexing ? ` + sitemap.xml (${snap.posts.length + snap.pages.length + 1} URL)` : "; sitemap নেই"}`);
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
