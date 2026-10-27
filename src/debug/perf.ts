// ডিবাগ-মাত্র (সরানো সহজ: src/debug/ মুছুন + সব `pmark(` লাইন ও <PerfOverlay /> বাদ + worker.ts-এর Server-Timing অংশ)।
// চালু: /dashboard?perf=1 (বন্ধ: ?perf=0)। সময় = শেষ ট্যাপ থেকে ms।
const FLAG = "dbg:perf";
const LOG = "dbg:perf:log";
const MAX = 150;
export type Row = { t: number; label: string };

let t0 = 0;

export function perfOn(): boolean {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}
export function applyPerfQuery(): void {
  try {
    const q = new URLSearchParams(location.search).get("perf");
    if (q === "1") localStorage.setItem(FLAG, "1");
    if (q === "0") localStorage.removeItem(FLAG);
  } catch {
    /* ignore */
  }
}
export const setTap = (): void => {
  t0 = performance.now();
};
export const rel = (abs: number): number => Math.round(abs - t0);

export function readRows(): Row[] {
  try {
    return JSON.parse(sessionStorage.getItem(LOG) ?? "[]") as Row[];
  } catch {
    return [];
  }
}
export function clearRows(): void {
  try {
    sessionStorage.removeItem(LOG);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("dbg-perf"));
}
/** `at` = performance.now()-ভিত্তিক সময় (না দিলে এখন) */
export function pmark(label: string, at?: number): void {
  if (typeof window === "undefined" || !perfOn()) return;
  try {
    const rows = readRows();
    rows.push({ t: rel(at ?? performance.now()), label });
    sessionStorage.setItem(LOG, JSON.stringify(rows.slice(-MAX)));
    window.dispatchEvent(new Event("dbg-perf"));
  } catch {
    /* ignore */
  }
}
