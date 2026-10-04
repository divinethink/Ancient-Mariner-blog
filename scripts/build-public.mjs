// Next prerender করা public HTML → Workers assets-এ কপি (উপায় ১, Arch §৫ P0a)
import { readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";

const SRC = ".next/server/app";
const DEST = ".open-next/assets";
const SKIP_FIRST = /^(_|dashboard|login|api)/;
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const copied = [];
for (const f of walk(SRC)) {
  if (!f.endsWith(".html")) continue;
  const segs = relative(SRC, f).split(sep).map(dec);
  if (SKIP_FIRST.test(segs[0])) continue;
  const out = join(DEST, ...segs);
  mkdirSync(dirname(out), { recursive: true });
  copyFileSync(f, out);
  copied.push(segs.join("/"));
}
if (copied.length === 0) {
  console.error("❌ কোনো public HTML কপি হয়নি");
  process.exit(1);
}
writeFileSync(join(DEST, "build.json"), JSON.stringify({ builtAt: new Date().toISOString() }));
console.log("✅ assets-এ কপি:\n" + copied.map((c) => " - " + c).join("\n"));

// _redirects / _headers assets-এ পৌঁছেছে কিনা
for (const n of ["_redirects", "_headers"]) {
  if (!existsSync(join(DEST, n))) { console.error(`❌ ${n} assets-এ নেই`); process.exit(1); }
}
