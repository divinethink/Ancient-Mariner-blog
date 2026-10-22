"use client";

// মেনুর শীর্ষে থিম-গ্রিড (ধাপ ১): ৬ থিম, গ্লোবাল। ComfortPanel (Aa)-এর মতো একই readThemePref/saveThemePref → data-theme তাৎক্ষণিক, রিলোডেও থাকে।
import { useSyncExternalStore } from "react";
import { readThemePref, saveThemePref } from "@/data/comfortStore";
import { Icon } from "@/components/icons";
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
// প্রিভিউ-রঙ: theme/tokens.css-এর --bg/--text/--accent-এর সাথে মেলানো (auto = আধা-আলো আধা-গাঢ়, মাঝারি ধূসর লেখা)
const PREVIEW: Record<ThemePref, { text: string; accent: string }> = {
  auto: { text: "#8a8680", accent: "#c96442" },
  light: { text: "#1f1e1d", accent: "#c96442" },
  sepia: { text: "#3b3226", accent: "#b5552f" },
  warm: { text: "#45301c", accent: "#b9531a" },
  dark: { text: "#ece8df", accent: "#e0805f" },
  amoled: { text: "#ece8df", accent: "#e0805f" },
};
const previewBg = (k: ThemePref) =>
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
      <div className="grid grid-cols-3 gap-2.5">
        {THEME_PREFS.map((k) => {
          const on = theme === k;
          const c = PREVIEW[k];
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => pick(k)}
              className={`relative overflow-hidden rounded-2xl border-2 text-center transition-shadow ${
                on ? "border-accent shadow-md" : "border-line"
              }`}
            >
              <span aria-hidden className="block px-3 pb-2 pt-3 text-left" style={{ background: previewBg(k) }}>
                <span className="block font-serif text-2xl font-bold leading-none" style={{ color: c.text }}>
                  আ
                </span>
                <span className="mt-2 block h-1 w-full rounded-full" style={{ background: c.text, opacity: 0.35 }} />
                <span className="mt-1 block h-1 w-3/4 rounded-full" style={{ background: c.text, opacity: 0.35 }} />
                <span className="mt-1.5 block h-1.5 w-1/3 rounded-full" style={{ background: c.accent }} />
              </span>
              <span className={`block bg-surface py-1.5 text-[13px] ${on ? "font-semibold" : "text-muted"}`}>{LABEL[k]}</span>
              {on && (
                <span
                  aria-hidden
                  className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-btn-bg text-btn-tx"
                >
                  <Icon name="check" size={13} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
