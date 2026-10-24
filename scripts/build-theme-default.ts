// siteSettings.defaultTheme → assets-এর `theme-init.js`-এর DEFAULT_THEME (P2c-১)। snapshot থেকে পড়ে — আলাদা Firestore read নেই।
import { readFile, writeFile } from "node:fs/promises";
import { readSnapshot } from "../src/data/publicSnapshot";
import { applyDesign } from "../src/lib/design";
import { applyDefaultTheme } from "../src/lib/siteSettings";

const FILE = ".open-next/assets/theme-init.js";

async function main() {
  const snap = await readSnapshot();
  if (!snap) throw new Error("build snapshot নেই");
  const next = applyDesign(applyDefaultTheme(await readFile(FILE, "utf8"), snap.settings.defaultTheme), snap.settings.design);
  await writeFile(FILE, next, "utf8");
  const d = snap.settings.design;
  console.log(`✅ theme-init.js: default থিম = ${snap.settings.defaultTheme}; design = ${d.palette}/${d.accent}/${d.fontPair}/${d.cardStyle}`);
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
