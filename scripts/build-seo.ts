// sitemap.xml ও robots.txt → assets-এ সরাসরি (build-redirects.ts-এর ধাঁচ; Worker চলে না)। snapshot থেকে পড়ে — আলাদা Firestore read নেই।
import { writeFile } from "node:fs/promises";
import { readSnapshot } from "../src/data/publicSnapshot";
import { getSiteUrl } from "../src/config/env";
import { renderRobots, renderSitemap } from "../src/lib/seo";

const DIR = ".open-next/assets";

async function main() {
  const snap = await readSnapshot();
  if (!snap) throw new Error("build snapshot নেই");
  const siteUrl = getSiteUrl();
  const { allowIndexing, blockAiCrawlers } = snap.settings;
  await writeFile(`${DIR}/robots.txt`, renderRobots({ siteUrl, allowIndexing, blockAiCrawlers }), "utf8");
  if (allowIndexing) {
    await writeFile(`${DIR}/sitemap.xml`, renderSitemap(siteUrl, snap.posts), "utf8");
  }
  console.log(`✅ robots.txt (ইনডেক্স ${allowIndexing ? "চালু" : "বন্ধ"}, AI-ব্লক ${blockAiCrawlers ? "চালু" : "বন্ধ"})${allowIndexing ? ` + sitemap.xml (${snap.posts.length + 1} URL)` : "; sitemap নেই"}`);
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
