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
      <div className="grid grid-cols-3 gap-2">
        {THEME_PREFS.map((k) => {
          const on = theme === k;
          const c = PREVIEW[k];
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => pick(k)}
              className={`flex min-h-11 items-center gap-1.5 rounded-xl border px-1 py-1 text-[12.5px] ${
                on ? "border-accent bg-surface font-semibold ring-1 ring-accent" : "border-line"
              }`}
            >
              <span
                aria-hidden
                className="relative flex size-6 shrink-0 flex-col items-center justify-center rounded-lg border border-line"
                style={{ background: previewBg(k) }}
              >
                <span className="font-serif text-xs font-bold leading-none" style={{ color: c.text }}>
                  আ
                </span>
                <span className="mt-0.5 h-0.5 w-3 rounded-full" style={{ background: c.accent }} />
                {on && (
                  <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-btn-bg text-btn-tx">
                    <Icon name="check" size={9} strokeWidth={3.5} />
                  </span>
                )}
              </span>
              <span className="whitespace-nowrap">{LABEL[k]}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
