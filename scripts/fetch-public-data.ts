// build-এর শুরুতে একবার Firestore REST থেকে সব published+public পোস্ট ও siteSettings পড়ে `.build-data/posts.json`-এ রাখে (Arch §২)।
// ব্যর্থ হলে exit 1 — deploy থামে, বিদ্যমান সাইট অক্ষত থাকে। `fetchedAt` = পড়া শুরুর UTC → `/build.json` `builtAt`।
import { getPublicPostSource } from "../src/data/postRepo.server";
import { SNAPSHOT_PATH, writeSnapshot } from "../src/data/publicSnapshot";
import { getPublicPageSource } from "../src/data/pageRepo.server";
import { getPublicTaxonomySource } from "../src/data/taxonomyRepo.server";
import { getPublicSettingsSource } from "../src/data/siteSettingsRepo.server";
import { designMediaIds } from "../src/lib/design";
import { mediaIdsOf } from "../src/lib/gallery";
import { getPublicMediaSource } from "../src/data/mediaRepo.server";

async function main() {
  const startedAt = new Date();
  const posts = await getPublicPostSource().listPublished();
  const settings = await getPublicSettingsSource().read();
  const terms = await getPublicTaxonomySource().listAll();
  const pages = await getPublicPageSource().listPublished();
  // P6-৩ক/P8a-২: শুধু published লেখার cover + gallery id (প্রতি id-তে ১ read; না-পাওয়া/private বাদ, আসল নেট-ত্রুটিতে build থামে)
  const coverIds = [...new Set([...mediaIdsOf(posts), ...designMediaIds(settings.design)])]; // + P9b-২ logo/banner
  const media = await getPublicMediaSource().getMany(coverIds);
  await writeSnapshot(posts, startedAt, SNAPSHOT_PATH, settings, terms, pages, media);
  console.log(`✅ ${posts.length}টি published+public লেখা + সাইট-সেটিং (ইনডেক্স: ${settings.allowIndexing ? "চালু" : "বন্ধ"}) + ${terms.categories.length} ক্যাটাগরি/${terms.tags.length} ট্যাগ/${terms.series.length} সিরিজ + ${pages.length}টি পেজ + ${media.length}/${coverIds.length}টি cover/gallery-ছবি → ${SNAPSHOT_PATH}`);
}

main().catch((e) => {
  console.error("❌ পাবলিক ডেটা পড়া যায়নি:", e instanceof Error ? e.message : e);
  process.exit(1);
});
