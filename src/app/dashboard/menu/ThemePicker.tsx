"use client";

// মেনুর শীর্ষে থিম-গ্রিড (ধাপ ১): ৬ থিম, গ্লোবাল। ComfortPanel (Aa)-এর মতো একই readThemePref/saveThemePref → data-theme তাৎক্ষণিক, রিলোডেও থাকে।
import { useSyncExternalStore } from "react";
import { readThemePref, saveThemePref } from "@/data/comfortStore";
import { bn } from "@/i18n/bn";
import { THEME_BG, THEME_PREFS, type ThemePref } from "@/lib/comfort";

const names = bn.editor.comfort;
const LABEL: Record<ThemePref, string> = {
  auto: names.themeAuto,
  light: names.themeLight,
  sepia: names.themeSepia,
  warm: names.themeWarm,
  dark: names.themeDark,
  amoled: names.themeAmoled,
};
// auto = আধা-আলো আধা-গাঢ় নমুনা
const swatch = (k: ThemePref) =>
  k === "auto" ? `linear-gradient(135deg, ${THEME_BG.light} 50%, ${THEME_BG.dark} 50%)` : THEME_BG[k];

// hydration-নিরাপদ: সার্ভারে "light", ক্লায়েন্টে আসল পছন্দ; বদলালে listener-দের জানানো
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export function ThemePicker() {
  const theme = useSyncExternalStore(subscribe, readThemePref, () => "light");
  const pick = (p: ThemePref) => {
    saveThemePref(p);
    listeners.forEach((fn) => fn());
  };
  return (
    <section aria-label={bn.dashboard.themeTitle} className="mb-5">
      <h2 className="mb-1.5 px-1 text-sm text-muted">{bn.dashboard.themeTitle}</h2>
      <div className="grid grid-cols-3 gap-2">
        {THEME_PREFS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={theme === k}
            onClick={() => pick(k)}
            className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-sm ${
              theme === k ? "border-accent bg-surface font-semibold" : "border-line"
            }`}
          >
            <span
              aria-hidden
              className="size-5 shrink-0 rounded-full border border-line"
              style={{ background: swatch(k) }}
            />
            <span className="truncate">{LABEL[k]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
