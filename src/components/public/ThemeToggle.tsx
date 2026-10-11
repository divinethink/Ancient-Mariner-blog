"use client";
import { useEffect, useState } from "react";
import { bn } from "@/i18n/bn";
import { THEME_BG, THEME_PREFS, type ThemePref, resolveTheme } from "@/lib/comfort";

const names = bn.editor.comfort;
const NAME: Record<ThemePref, string> = {
  auto: names.themeAuto,
  light: names.themeLight,
  sepia: names.themeSepia,
  warm: names.themeWarm,
  dark: names.themeDark,
  amoled: names.themeAmoled,
};
const isPref = (v: unknown): v is ThemePref => (THEME_PREFS as readonly unknown[]).includes(v);

/** পাবলিক header-এর থিম টগল: ৬ থিম (অটো/লাইট/সেপিয়া/উষ্ণ/ডার্ক/AMOLED) ঘোরায়; 'theme' key-তে সংরক্ষণ (theme-init.js-ও পড়ে) */
export function ThemeToggle({ inMenu = false }: { inMenu?: boolean }) {
  const [pref, setPref] = useState<ThemePref>("light");
  useEffect(() => {
    let v: string | null = null;
    try {
      v = localStorage.getItem("theme");
    } catch {
      /* storage বন্ধ */
    }
    v = v ?? document.documentElement.getAttribute("data-default-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-এ storage থেকে পড়া
    if (isPref(v)) setPref(v);
  }, []);
  const next = () => {
    const n = THEME_PREFS[(THEME_PREFS.indexOf(pref) + 1) % THEME_PREFS.length]!;
    setPref(n);
    const t = resolveTheme(n, window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", t);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_BG[t] ?? THEME_BG.light!);
    try {
      localStorage.setItem("theme", n);
    } catch {
      /* শুধু এই পেজে প্রযোজ্য */
    }
  };
  return (
    <button type="button" onClick={next} aria-label={`${bn.public.themeToggle}: ${NAME[pref]}`} title={`${bn.public.themeToggle}: ${NAME[pref]}`} className={inMenu ? "inline-flex min-h-11 w-full items-center rounded-lg px-2 text-start" : "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-surface px-2 text-sm"}>
      🎨 <span className={inMenu ? "ms-2" : "ms-1 hidden min-[760px]:inline"}>{inMenu ? `${bn.public.themeToggle}: ${NAME[pref]}` : NAME[pref]}</span>
    </button>
  );
}
