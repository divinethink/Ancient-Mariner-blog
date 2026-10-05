// build-এর শুরুতে একবার Firestore REST থেকে সব published+public পোস্ট পড়ে `.build-data/posts.json`-এ রাখে (Arch §২)।
// ব্যর্থ হলে exit 1 — deploy থামে, বিদ্যমান সাইট অক্ষত থাকে। `fetchedAt` = পড়া শুরুর UTC → `/build.json` `builtAt`।
import { getPublicPostSource } from "../src/data/postRepo.server";
import { SNAPSHOT_PATH, writeSnapshot } from "../src/data/publicSnapshot";

async function main() {
  const startedAt = new Date();
  const posts = await getPublicPostSource().listPublished();
  await writeSnapshot(posts, startedAt);
  console.log(`✅ ${posts.length}টি published+public লেখা → ${SNAPSHOT_PATH}`);
}

main().catch((e) => {
  console.error("❌ পাবলিক ডেটা পড়া যায়নি:", e instanceof Error ? e.message : e);
  process.exit(1);
});
