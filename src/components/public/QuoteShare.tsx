"use client";
import { useEffect, useRef, useState } from "react";
import { bn } from "@/i18n/bn";
import { cleanQuote, facebookQuoteUrl, quotePopupPos, quoteShareText } from "@/lib/reader";

const t = bn.public;
type Pop = { text: string; top: number; left: number };
const HIDE_DELAY = 300; // টাচে বোতাম-ট্যাপের সময় নির্বাচন মুছলেও click যেন হারায় না

/**
 * উদ্ধৃতি-শেয়ার পপ-আপ (P12-১): `.reading`-এর ভেতরে লেখা নির্বাচন করলে [কপি] ও [শেয়ার] (নেটিভ share; না থাকলে Facebook quote-লিংক)।
 * শুধু plain text (cleanQuote); নতুন লাইব্রেরি/schema নেই; JS বন্ধ থাকলে কিছু দেখায় না, লেখা অক্ষত।
 */
export function QuoteShare({ title, url }: { title: string; url?: string }) {
  const [pop, setPop] = useState<Pop | null>(null);
  const [msg, setMsg] = useState("");
  const [native, setNative] = useState(false);
  const timers = useRef<{ read?: number; hide?: number; msg?: number }>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-এ ক্ষমতা-যাচাই
    setNative(typeof navigator.share === "function");
    const tm = timers.current;
    const read = () => {
      const sel = window.getSelection();
      const root = document.querySelector(".reading");
      const anc = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).commonAncestorContainer : null;
      const text = sel && !sel.isCollapsed && root && anc && root.contains(anc.nodeType === 1 ? anc : anc.parentNode) ? cleanQuote(sel.toString()) : null;
      if (!text || !sel) {
        window.clearTimeout(tm.hide);
        tm.hide = window.setTimeout(() => setPop(null), HIDE_DELAY);
        return;
      }
      window.clearTimeout(tm.hide);
      const r = sel.getRangeAt(0).getBoundingClientRect();
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      setPop({ text, ...quotePopupPos(r, window.innerWidth, window.innerHeight, coarse) });
    };
    const onChange = () => {
      window.clearTimeout(tm.read);
      tm.read = window.setTimeout(read, 120);
    };
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("scroll", onChange, { passive: true });
    window.addEventListener("resize", onChange, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
      window.clearTimeout(tm.read);
      window.clearTimeout(tm.hide);
      window.clearTimeout(tm.msg);
    };
  }, []);

  if (!pop) return null;
  const flash = (m: string) => {
    setMsg(m);
    window.clearTimeout(timers.current.msg);
    timers.current.msg = window.setTimeout(() => setMsg(""), 2000);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(quoteShareText(pop.text, title, url));
      flash(t.copied);
    } catch {
      flash(t.copyFailed);
    }
  };
  const share = async () => {
    try {
      await navigator.share({ text: quoteShareText(pop.text, title), ...(url ? { url } : {}) });
    } catch {
      /* বাতিল (AbortError) বা অসমর্থিত — নীরবে */
    }
  };
  const fb = native ? null : facebookQuoteUrl(url, pop.text);
  const btn = "inline-flex min-h-11 flex-1 items-center justify-center px-3 text-sm";
  return (
    <div
      role="toolbar"
      aria-label={t.quoteBar}
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-50 flex w-[200px] items-center divide-x divide-line overflow-hidden rounded-full border border-line bg-surface shadow-lg select-none"
      style={{ top: pop.top, left: pop.left }}
    >
      {msg ? (
        <span role="status" aria-live="polite" className={`${btn} text-muted`}>
          {msg}
        </span>
      ) : (
        <>
          <button type="button" onClick={copy} className={btn}>
            {t.quoteCopy}
          </button>
          {native ? (
            <button type="button" onClick={share} className={btn}>
              {t.quoteShare}
            </button>
          ) : (
            fb && (
              <a href={fb} target="_blank" rel="noopener noreferrer" className={btn}>
                {t.quoteShare}
              </a>
            )
          )}
        </>
      )}
    </div>
  );
}
