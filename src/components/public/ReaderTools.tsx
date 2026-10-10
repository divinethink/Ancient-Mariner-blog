"use client";
import { useEffect, useState } from "react";
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
    <div role="group" aria-label={t.sizeLabel} className="inline-flex items-center gap-1">
      <span aria-hidden="true" className="px-1 font-serif text-sm text-muted">
        Aa
      </span>
      {READER_SIZES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => pick(s)}
          aria-pressed={size === s}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm ${size === s ? "border-accent bg-accent/10 font-semibold" : "border-line"}`}
        >
          {label[s]}
        </button>
      ))}
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
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      {t.fontLabel}
      <select value={font} onChange={(e) => pick(e.target.value)} className="min-h-11 rounded-full border border-line bg-surface px-3 text-text">
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

/** জেন মোড (P12-১): header/footer/সূচি/শেয়ার/মন্তব্য (.zen-hide) লুকিয়ে বিশুদ্ধ পড়া; সংরক্ষণ হয় না; Esc বা ভাসমান ✕ বোতামে বেরোনো */
export function ZenToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    if (!on) return;
    root.setAttribute("data-zen", "true");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOn(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.removeAttribute("data-zen");
    };
  }, [on]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        aria-pressed={on}
        className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm ${on ? "border-accent bg-accent/10 font-semibold" : "border-line"}`}
      >
        ⌗ {t.zenOn}
      </button>
      {on && (
        <button
          type="button"
          onClick={() => setOn(false)}
          aria-label={t.zenExit}
          className="fixed end-4 z-50 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-surface shadow-lg"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
        >
          ✕
        </button>
      )}
    </>
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
