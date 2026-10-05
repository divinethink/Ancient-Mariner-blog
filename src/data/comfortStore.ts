// আরাম-সেটিং ও থিম-পছন্দ: পড়া/সংরক্ষণ/DOM-এ প্রয়োগ (প্রতি-ডিভাইস; Arch §১১)
import { type Comfort, type ThemePref, THEME_BG, comfortVars, parseComfort, resolveTheme } from "@/lib/comfort";
import { prefs } from "./localStore";

const COMFORT_KEY = "comfort";
const THEME_KEY = "theme"; // public/theme-init.js-ও এই key পড়ে

export const readComfort = (): Comfort => parseComfort(prefs.get(COMFORT_KEY));

export function applyComfort(c: Comfort): void {
  const st = document.documentElement.style;
  for (const [k, v] of Object.entries(comfortVars(c))) st.setProperty(k, v);
}

export function saveComfort(c: Comfort): void {
  prefs.set(COMFORT_KEY, JSON.stringify(c));
  applyComfort(c);
}

export function readThemePref(): string {
  return prefs.get(THEME_KEY) ?? document.documentElement.getAttribute("data-default-theme") ?? "light";
}

export function saveThemePref(p: ThemePref): void {
  prefs.set(THEME_KEY, p);
  const t = resolveTheme(p, window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_BG[t] ?? THEME_BG.light);
}

const FOCUS_KEY = "focusMode";
export const readFocus = (): boolean => prefs.get(FOCUS_KEY) === "1";
export const saveFocus = (on: boolean): void => prefs.set(FOCUS_KEY, on ? "1" : "0");
