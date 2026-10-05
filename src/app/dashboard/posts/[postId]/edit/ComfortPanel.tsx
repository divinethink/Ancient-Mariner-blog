"use client";

// আরাম-প্যানেল (Aa): থিম/ফন্ট/আকার/লাইনের ফাঁক/চওড়া — প্রতি-ডিভাইস, তাৎক্ষণিক প্রয়োগ (Arch §১১)
import { useEffect, useRef, useState } from "react";
import { readComfort, readThemePref, saveComfort, saveThemePref } from "@/data/comfortStore";
import { bn } from "@/i18n/bn";
import { type Comfort, LINE_RANGE, SIZE_RANGE, type ThemePref, WIDTHS } from "@/lib/comfort";

const t = bn.editor.comfort;
const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 text-sm ${on ? "border-accent bg-btn-bg text-btn-tx" : "border-line"}`;

export function ComfortPanel({ onClose }: { onClose: () => void }) {
  const [c, setC] = useState<Comfort>(readComfort);
  const [theme, setTheme] = useState(readThemePref);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (patch: Partial<Comfort>) => {
    const next = { ...c, ...patch };
    setC(next);
    saveComfort(next);
  };
  const pickTheme = (p: ThemePref) => {
    setTheme(p);
    saveThemePref(p);
  };
  const widthLabel = { 560: t.narrow, 680: t.medium, 860: t.wide } as const;
  const h = "mb-1.5 mt-4 text-sm text-muted first:mt-0";

  return (
    <>
      <button type="button" aria-label={t.close} tabIndex={-1} onClick={onClose} className="fixed inset-0 z-30 cursor-default" />
      <div
        role="dialog"
        aria-label={t.title}
        className="fixed inset-x-3 top-16 z-40 mx-auto max-h-[calc(100dvh-5rem)] max-w-sm overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-lg"
      >
        <h2 className={h}>{t.theme}</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["auto", t.themeAuto],
              ["light", t.themeLight],
              ["dark", t.themeDark],
            ] as const
          ).map(([k, label], i) => (
            <button
              key={k}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              aria-pressed={theme === k}
              onClick={() => pickTheme(k)}
              className={chip(theme === k)}
            >
              {label}
            </button>
          ))}
        </div>

        <h2 className={h}>{t.font}</h2>
        <div className="flex gap-2">
          {(
            [
              ["serif", t.serif],
              ["sans", t.sans],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={c.font === k} onClick={() => set({ font: k })} className={chip(c.font === k)}>
              {label}
            </button>
          ))}
        </div>

        <label className={`${h} block`} htmlFor="cmf-size">
          {t.size} — {c.size}px
        </label>
        <input
          id="cmf-size"
          type="range"
          min={SIZE_RANGE.min}
          max={SIZE_RANGE.max}
          step={1}
          value={c.size}
          onChange={(e) => set({ size: Number(e.target.value) })}
          className="h-11 w-full accent-[var(--accent)]"
        />

        <label className={`${h} block`} htmlFor="cmf-line">
          {t.line} — {c.line / 10}
        </label>
        <input
          id="cmf-line"
          type="range"
          min={LINE_RANGE.min}
          max={LINE_RANGE.max}
          step={1}
          value={c.line}
          onChange={(e) => set({ line: Number(e.target.value) })}
          className="h-11 w-full accent-[var(--accent)]"
        />

        <h2 className={h}>{t.width}</h2>
        <div className="flex flex-wrap gap-2">
          {WIDTHS.map((w) => (
            <button key={w} type="button" aria-pressed={c.width === w} onClick={() => set({ width: w })} className={chip(c.width === w)}>
              {widthLabel[w]}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
