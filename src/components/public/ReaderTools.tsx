"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { bn } from "@/i18n/bn";
import { FONT_IDS, FONT_NAME, type FontId } from "@/lib/fonts";
import { DEFAULT_READER_SIZE, READER_FONT_KEY, READER_SIZES, READER_SIZE_KEY, type ReaderSize, resolveReaderFont, resolveReaderSize } from "@/lib/reader";

const t = bn.public;
const label: Record<ReaderSize, string> = { s: t.sizeSmall, m: t.sizeMedium, l: t.sizeLarge };

/** "Aa" লেখার-আকার (ছোট/মাঝারি/বড়): <html data-rsize> বসায় ও localStorage-এ রাখে; JS বন্ধ থাকলে লেখা default আকারে অক্ষত */
export function ReaderSize() {
  const [size, setSize] = useState<ReaderSize>(DEFAULT_READER_SIZE);
  useEffect(() => {
    const cur = resolveReaderSize(document.documentElement.getAttribute("data-rsize"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-এ DOM/storage থেকে পড়া
    setSize(cur);
  }, []);
  const pick = (s: ReaderSize) => {
    setSize(s);
    document.documentElement.setAttribute("data-rsize", s);
    try {
      localStorage.setItem(READER_SIZE_KEY, s);
    } catch {
      /* storage বন্ধ — শুধু এই পেজে প্রযোজ্য */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted">{t.sizeLabel}</span>
      <div role="group" aria-label={t.sizeLabel} className="inline-flex rounded-full bg-bg p-0.5">
      {READER_SIZES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => pick(s)}
          aria-pressed={size === s}
          className={`inline-flex min-h-9 items-center justify-center rounded-full px-3 text-sm ${size === s ? "bg-surface font-semibold text-accent-text shadow-sm" : "text-muted"}`}
        >
          {label[s]}
        </button>
      ))}
      </div>
    </div>
  );
}

/** পাঠকের ফন্ট-বাছাই (P12-১): <html data-rfont> বসায় ও localStorage-এ রাখে; 'সাইটের ডিফল্ট' = attribute সরানো; JS বন্ধ থাকলে লেখা অক্ষত */
export function ReaderFont() {
  const [font, setFont] = useState<FontId | "">("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-এ DOM থেকে পড়া
    setFont(resolveReaderFont(document.documentElement.getAttribute("data-rfont")));
  }, []);
  const pick = (raw: string) => {
    const f = resolveReaderFont(raw);
    setFont(f);
    const root = document.documentElement;
    if (f) root.setAttribute("data-rfont", f);
    else root.removeAttribute("data-rfont");
    try {
      if (f) localStorage.setItem(READER_FONT_KEY, f);
      else localStorage.removeItem(READER_FONT_KEY);
    } catch {
      /* storage বন্ধ — শুধু এই পেজে প্রযোজ্য */
    }
  };
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-muted">
      {t.fontLabel}
      <select value={font} onChange={(e) => pick(e.target.value)} className="min-h-10 w-40 min-w-0 rounded-full border border-line bg-bg px-3 text-text">
        <option value="">{t.fontDefault}</option>
        {FONT_IDS.map((id) => (
          <option key={id} value={id}>
            {FONT_NAME[id]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** জেন মোড (P12-১) সুইচ-সারি: অবস্থা ReaderBar-এ (প্যানেল বন্ধ হলেও জেন চলে) */
export function ZenToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex min-h-11 w-full items-center justify-between gap-3 text-sm">
      <span className="text-muted">{t.zenOn}</span>
      <span aria-hidden="true" className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${on ? "start-[22px]" : "start-0.5"}`} />
      </span>
    </button>
  );
}

/** লিংক-কপি (clipboard; না থাকলে নির্বাচন-fallback নয় — বার্তা দেখায়) */
export function CopyLink({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState("ok");
    } catch {
      setState("fail");
    }
    setTimeout(() => setState("idle"), 2500);
  };
  return (
    <>
      <button type="button" onClick={copy} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm">
        {t.copyLink}
      </button>
      <span role="status" aria-live="polite" className="text-sm text-muted">
        {state === "ok" ? t.copied : state === "fail" ? t.copyFailed : ""}
      </span>
    </>
  );
}

/** পড়ার টুলবার: সারিতে বামে children (← পিছনে লিংক), ডানে "Aa" বোতাম; চাপলে ছোট ভাসমান প্যানেলে আকার/ফন্ট/জেন মোড (লেআউট নড়ে না) */
export function ReaderBar({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [zen, setZen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // জেন মোড: header/footer/সূচি/শেয়ার/মন্তব্য (.zen-hide) লুকিয়ে বিশুদ্ধ পড়া; সংরক্ষণ হয় না; Esc বা ভাসমান ✕-এ বেরোনো
  useEffect(() => {
    if (!zen) return;
    const root = document.documentElement;
    root.setAttribute("data-zen", "true");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.removeAttribute("data-zen");
    };
  }, [zen]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative mb-4 flex items-center justify-between gap-2">
      <div className="min-w-0">{children}</div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="reader-settings"
        aria-label={t.readerSettings}
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border font-serif text-lg ${open ? "border-accent bg-accent/10 text-accent-text" : "border-line text-text"}`}
      >
        Aa
      </button>
      {open && (
        <div id="reader-settings" className="absolute end-0 top-full z-20 mt-1 w-72 max-w-full divide-y divide-line rounded-2xl border border-line bg-surface px-4 py-1 shadow-lg">
          <div className="py-1.5">
            <ReaderSize />
          </div>
          <div className="py-1.5">
            <ReaderFont />
          </div>
          <ZenToggle on={zen} onChange={(v) => { setZen(v); if (v) setOpen(false); }} />
        </div>
      )}
      {zen && (
        <button
          type="button"
          onClick={() => setZen(false)}
          aria-label={t.zenExit}
          className="fixed end-4 z-50 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-surface shadow-lg"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
