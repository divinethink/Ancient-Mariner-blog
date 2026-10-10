"use client";
import { useEffect, useState } from "react";
import { bn } from "@/i18n/bn";
import { DEFAULT_READER_SIZE, READER_SIZES, READER_SIZE_KEY, type ReaderSize, resolveReaderSize } from "@/lib/reader";

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
