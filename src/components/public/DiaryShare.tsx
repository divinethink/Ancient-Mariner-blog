"use client";

// দিনলিপি-কার্ডের শেয়ার আইকন → নিচ থেকে শেয়ার-শিট: ফেসবুক · হোয়াটসঅ্যাপ · লিংক কপি · (ডিভাইসে থাকলে) আরও।
// শুধু বাইরের লিংক খোলে/ক্লিপবোর্ডে কপি করে; কিছু লেখে না।
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { bn } from "@/i18n/bn";
import { shareLinks } from "@/lib/diaryShare";

const S = bn.diary.share;
const opt = "flex min-h-11 flex-col items-center gap-1.5 text-center text-xs";
const dot = "flex size-13 items-center justify-center rounded-full text-xl font-bold text-white";

export function DiaryShare({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [native, setNative] = useState(false);
  const [msg, setMsg] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const links = shareLinks(url, title);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-এ ব্রাউজারের সক্ষমতা পড়া
    setNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>("a,button")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMsg(S.copied);
    } catch {
      setMsg(S.failed);
    }
  }
  async function more() {
    try {
      await navigator.share({ title, url });
    } catch {
      /* ব্যবহারকারী বাতিল করলে কিছুই নয় */
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={S.button}
        aria-haspopup="dialog"
        onClick={() => {
          setMsg("");
          setOpen(true);
        }}
        className="dshare inline-flex size-10 items-center justify-center rounded-full border border-current"
      >
        <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
        </svg>
      </button>
      {open &&
        // body-তে portal: কার্ডের opacity/overflow/রং শিটকে স্বচ্ছ বা কাটা করে না
        createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <button type="button" aria-label={S.close} tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/45" />
          <div ref={ref} role="dialog" aria-modal="true" aria-label={S.title} className="relative w-full max-w-md space-y-4 rounded-t-3xl bg-bg p-5 text-left font-sans text-base md:rounded-3xl">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold">{S.title}</h2>
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full border border-line px-4 text-sm">
                {S.close}
              </button>
            </div>
            <p className="truncate rounded-xl bg-surface px-3 py-2 text-sm text-muted">{url}</p>
            <div className="grid grid-cols-4 gap-2">
              {links.facebook && (
                <a href={links.facebook} target="_blank" rel="noopener noreferrer" className={opt}>
                  <span className={dot} style={{ background: "#1877f2" }}>
                    f
                  </span>
                  {S.facebook}
                </a>
              )}
              {links.whatsapp && (
                <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={opt}>
                  <span className={dot} style={{ background: "#25d366" }}>
                    ✆
                  </span>
                  {S.whatsapp}
                </a>
              )}
              <button type="button" onClick={() => void copy()} className={opt}>
                <span className={dot} style={{ background: "#435f8f" }}>
                  🔗
                </span>
                {S.copy}
              </button>
              {native && (
                <button type="button" onClick={() => void more()} className={opt}>
                  <span className={dot} style={{ background: "#6b7280" }}>
                    ⋯
                  </span>
                  {S.more}
                </button>
              )}
            </div>
            <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted">
              {msg}
            </p>
          </div>
        </div>,
        document.body,
        )}
    </>
  );
}
