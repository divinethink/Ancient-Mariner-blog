"use client";
import { useEffect, useRef, useState } from "react";
import { bn } from "@/i18n/bn";

const SHOW_AFTER = 480; // px — এর পরে compact header ও ↑ বোতাম

/**
 * পাবলিক লেখার পাতার পড়ার-UI (P10b-১): (১) ওপরে ৩px পড়ার-progress bar, (২) কিছুটা নামলে compact sticky header (লেখার শিরোনাম) ও ↑ back-to-top।
 * scroll-এ React re-render নেই — bar সরাসরি ref-এ (transform) বদলায়; listener passive + rAF। reduced-motion-এ smooth-scroll/transition বন্ধ। JS বন্ধ থাকলে কিছুই দেখায় না, লেখা অক্ষত।
 */
export function ReadingChrome({ targetId, title }: { targetId: string; title: string }) {
  const bar = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = document.getElementById(targetId);
      const y = window.scrollY;
      if (el && bar.current) {
        const top = el.getBoundingClientRect().top + y;
        const span = el.offsetHeight - window.innerHeight;
        const p = span > 0 ? (y - top) / span : y > top ? 1 : 0;
        bar.current.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
      }
      setShown(y > SHOW_AFTER);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [targetId]);

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <>
      <div aria-hidden="true" className="fixed inset-x-0 z-40 h-[3px]" style={{ top: "env(safe-area-inset-top, 0px)" }}>
        <div ref={bar} className="h-full origin-left bg-accent" style={{ transform: "scaleX(0)" }} />
      </div>
      <div
        className={`fixed inset-x-0 z-30 flex items-center gap-2 border-b border-line bg-bg/95 px-3 motion-safe:transition-opacity ${shown ? "opacity-100" : "pointer-events-none opacity-0"}`}
        style={{ top: "env(safe-area-inset-top, 0px)", paddingTop: 3 }}
        aria-hidden={!shown}
      >
        <span className="min-w-0 flex-1 truncate font-serif text-sm font-semibold">{title}</span>
        <button type="button" onClick={toTop} tabIndex={shown ? 0 : -1} aria-label={bn.public.backToTop} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-surface">
          ↑
        </button>
      </div>
    </>
  );
}
