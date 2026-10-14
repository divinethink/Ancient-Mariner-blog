// লোগো → assets-এর `icons/site-icon*.png` (favicon/apple-touch-icon; layout.tsx এগুলোর দিকে দেখায়)। snapshot থেকে পড়ে; ব্যর্থ হলে আগের আইকন।
import { mkdir, writeFile } from "node:fs/promises";
import { loadSiteIcon } from "../src/data/siteIcon";

const DIR = ".open-next/assets/icons";

async function main() {
  await mkdir(DIR, { recursive: true });
  for (const [kind, name] of [["icon", "site-icon.png"], ["apple", "site-icon-apple.png"]] as const) {
    const { bytes, source } = await loadSiteIcon(kind);
    await writeFile(`${DIR}/${name}`, bytes);
    console.log(`✅ ${name} (${bytes.length} bytes, উৎস: ${source === "logo" ? "লোগো" : "ফলব্যাক আইকন"})`);
  }
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
