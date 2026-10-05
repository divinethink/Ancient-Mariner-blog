// পুরনো ASCII slug → বর্তমান slug: build-সময়ে assets-এর `_redirects`-এ 308 (Arch §২)। বাংলা slug-এর stub পেজ Next নিজে বানায়।
// snapshot থেকে পড়ে — আলাদা Firestore read নেই।
import { readFile, writeFile } from "node:fs/promises";
import { readSnapshot } from "../src/data/publicSnapshot";
import { MAX_STATIC_REDIRECTS, planSlugMoves, renderRedirects } from "../src/lib/publicSite";

const FILE = ".open-next/assets/_redirects";

async function main() {
  const snap = await readSnapshot();
  if (!snap) throw new Error("build snapshot নেই");
  const { redirects, stubs } = planSlugMoves(snap.posts);
  if (redirects.length > MAX_STATIC_REDIRECTS) {
    throw new Error(`_redirects সীমা (${MAX_STATIC_REDIRECTS}) ছাড়িয়েছে: ${redirects.length} — owner-আলোচনা`);
  }
  const base = await readFile(FILE, "utf8");
  await writeFile(FILE, base.replace(/\s*$/, "\n") + renderRedirects(redirects), "utf8");
  console.log(`✅ _redirects: ${redirects.length}টি 308; বাংলা stub পেজ: ${stubs.length}টি`);
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
