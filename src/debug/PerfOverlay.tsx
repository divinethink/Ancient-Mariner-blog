"use client";

// ডিবাগ-মাত্র: পর্দায় সময়-তালিকা (পিসি/কনসোল ছাড়া)। চালু: /dashboard?perf=1
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { applyPerfQuery, clearRows, perfOn, pmark, readRows, rel, setTap, type Row } from "./perf";

export function PerfOverlay() {
  const [on] = useState(() => {
    applyPerfQuery();
    return perfOn();
  });
  const [rows, setRows] = useState<Row[]>(() => (on ? readRows() : []));
  const [hidden, setHidden] = useState(false);
  const path = usePathname();

  useEffect(() => {
    if (on) pmark(`ROUTE committed → ${path}`);
  }, [on, path]);

  useEffect(() => {
    if (!on) return;
    const refresh = () => setRows(readRows());
    window.addEventListener("dbg-perf", refresh);

    const onClick = (e: Event) => {
      const t = e.target as Element | null;
      if (t?.closest?.("[data-perf-overlay]")) return;
      setTap();
      pmark(`TAP ${(t?.closest?.("a,button")?.textContent ?? "").trim().slice(0, 24)}`, performance.now());
    };
    document.addEventListener("click", onClick, true);

    const obs: PerformanceObserver[] = [];
    const watch = (type: string, fn: (e: PerformanceEntry) => void) => {
      try {
        const o = new PerformanceObserver((l) => l.getEntries().forEach(fn));
        o.observe({ type, buffered: false });
        obs.push(o);
      } catch {
        /* এই ব্রাউজারে নেই */
      }
    };
    watch("resource", (x) => {
      const e = x as PerformanceResourceTiming;
      if (rel(e.responseEnd) < 0) return; // ট্যাপের আগের রিকোয়েস্ট বাদ
      let u: URL;
      try {
        u = new URL(e.name);
      } catch {
        return;
      }
      const rsc = u.searchParams.has("_rsc");
      const chunk = u.pathname.includes("/_next/static");
      const api = u.pathname.startsWith("/api/");
      if (!(rsc || api || (chunk && e.duration > 300))) return;
      const ttfb = e.responseStart ? Math.round(e.responseStart - e.requestStart) : -1;
      const st = e.serverTiming?.map((s) => `${s.name}${s.duration ? `=${Math.round(s.duration)}` : ""}${s.description ? `(${s.description})` : ""}`).join(" ") ?? "";
      pmark(`${rsc ? "RSC" : api ? "API" : "chunk"} ${u.pathname.slice(0, 38)} start@${rel(e.startTime)} ttfb=${ttfb} total=${Math.round(e.duration)} ${Math.round(e.transferSize / 1024)}KB ${st}`, e.responseEnd);
    });
    watch("longtask", (e) => {
      if (e.duration >= 80) pmark(`JANK main-thread blocked ${Math.round(e.duration)}ms (from @${rel(e.startTime)})`, e.startTime + e.duration);
    });
    const onFont = (e: Event) => pmark(`FONT loaded: ${(e as FontFaceSetLoadEvent).fontfaces.map((f) => f.family).join(",")}`);
    document.fonts?.addEventListener("loadingdone", onFont);

    return () => {
      window.removeEventListener("dbg-perf", refresh);
      document.removeEventListener("click", onClick, true);
      document.fonts?.removeEventListener("loadingdone", onFont);
      obs.forEach((o) => o.disconnect());
    };
  }, [on]);

  if (!on) return null;
  const btn = "rounded border border-white/40 px-2 py-1";
  if (hidden)
    return (
      <button data-perf-overlay type="button" onClick={() => setHidden(false)} className="fixed bottom-[76px] right-2 z-[60] rounded bg-black/80 px-2 py-1 text-[11px] text-white">
        perf
      </button>
    );
  return (
    <div data-perf-overlay className="fixed inset-x-1 bottom-[72px] z-[60] max-h-[42vh] overflow-auto rounded bg-black/85 p-2 font-mono text-[10px] leading-tight text-white">
      <div className="mb-1 flex gap-2 text-[11px]">
        <button type="button" className={btn} onClick={() => void navigator.clipboard?.writeText(rows.map((r) => `${r.t}ms  ${r.label}`).join("\n"))}>
          Copy
        </button>
        <button type="button" className={btn} onClick={clearRows}>
          Clear
        </button>
        <button type="button" className={btn} onClick={() => setHidden(true)}>
          Hide
        </button>
      </div>
      {rows.map((r, i) => (
        <div key={i}>
          <b>{r.t}ms</b> {r.label}
        </div>
      ))}
    </div>
  );
}
