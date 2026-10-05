// siteSettings.defaultTheme → assets-এর `theme-init.js`-এর DEFAULT_THEME (P2c-১)। snapshot থেকে পড়ে — আলাদা Firestore read নেই।
import { readFile, writeFile } from "node:fs/promises";
import { readSnapshot } from "../src/data/publicSnapshot";
import { applyDefaultTheme } from "../src/lib/siteSettings";

const FILE = ".open-next/assets/theme-init.js";

async function main() {
  const snap = await readSnapshot();
  if (!snap) throw new Error("build snapshot নেই");
  const next = applyDefaultTheme(await readFile(FILE, "utf8"), snap.settings.defaultTheme);
  await writeFile(FILE, next, "utf8");
  console.log(`✅ theme-init.js: default থিম = ${snap.settings.defaultTheme}`);
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
