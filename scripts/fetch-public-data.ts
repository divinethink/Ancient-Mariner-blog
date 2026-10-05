// build-এর শুরুতে একবার Firestore REST থেকে সব published+public পোস্ট ও siteSettings পড়ে `.build-data/posts.json`-এ রাখে (Arch §২)।
// ব্যর্থ হলে exit 1 — deploy থামে, বিদ্যমান সাইট অক্ষত থাকে। `fetchedAt` = পড়া শুরুর UTC → `/build.json` `builtAt`।
import { getPublicPostSource } from "../src/data/postRepo.server";
import { SNAPSHOT_PATH, writeSnapshot } from "../src/data/publicSnapshot";
import { getPublicSettingsSource } from "../src/data/siteSettingsRepo.server";

async function main() {
  const startedAt = new Date();
  const posts = await getPublicPostSource().listPublished();
  const settings = await getPublicSettingsSource().read();
  await writeSnapshot(posts, startedAt, SNAPSHOT_PATH, settings);
  console.log(`✅ ${posts.length}টি published+public লেখা + সাইট-সেটিং (ইনডেক্স: ${settings.allowIndexing ? "চালু" : "বন্ধ"}) → ${SNAPSHOT_PATH}`);
}

main().catch((e) => {
  console.error("❌ পাবলিক ডেটা পড়া যায়নি:", e instanceof Error ? e.message : e);
  process.exit(1);
});
