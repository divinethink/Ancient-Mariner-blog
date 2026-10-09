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

const NAV_KEY = "navCollapsed";
export const readNavCollapsed = (): boolean => prefs.get(NAV_KEY) === "1";
export const saveNavCollapsed = (on: boolean): void => prefs.set(NAV_KEY, on ? "1" : "0");

// লাইব্রেরি হোমের কার্ড (দৈনিক-লক্ষ্য / At a Glance / আইডিয়া-বাছাই) — প্রতি-ডিভাইস, default চালু (P7a)
export type HomeCard = "goal" | "glance" | "pick";
const HOME_KEY = (c: HomeCard) => `homeCard:${c}`;
export const readHomeCard = (c: HomeCard): boolean => prefs.get(HOME_KEY(c)) !== "0";
export const HOME_CARDS_EVENT = "homecards-change";
export const saveHomeCard = (c: HomeCard, on: boolean): void => {
  prefs.set(HOME_KEY(c), on ? "1" : "0");
  if (typeof window !== "undefined") window.dispatchEvent(new Event(HOME_CARDS_EVENT)); // একই ট্যাবের কার্ড/Settings সতেজ রাখে
};
