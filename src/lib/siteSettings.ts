// siteSettings-এর pure সহায়ক (SDK/UI-মুক্ত): সীমা, timezone-যাচাই, থিম-default বসানো (P2c-১; Arch §৬ siteSettings)।
import type { Theme } from "./enums";

export const SETTINGS_DOC_ID = "main";
export const SETTINGS_SCHEMA_VERSION = 1;

export const SITE_TITLE_MAX = 80;
export const TAGLINE_MAX = 160;
export const POSTS_PER_PAGE_RANGE = { min: 5, max: 30 } as const;
export const DEFAULT_POSTS_PER_PAGE = 10;

/** Settings-এ দেখানো থিম-default (বাকি ৩ থিম P7b-তে picker-এ আসে; enum-এ আগে থেকেই আছে) */
export const SELECTABLE_THEMES: readonly Theme[] = ["auto", "light", "dark"];

/** সাধারণ সময়ক্ষেত্র; বর্তমান মান তালিকার বাইরে হলে UI সেটাও দেখায় (`timezoneChoices`) */
export const TIMEZONE_CHOICES = [
  "Asia/Dhaka",
  "Asia/Kolkata",
  "Asia/Karachi",
  "Asia/Kathmandu",
  "Asia/Colombo",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Bangkok",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
] as const;

/** IANA timezone-id কিনা (Intl যাচাই) */
export function isValidTimeZone(tz: string): boolean {
  if (tz.trim() === "") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** তালিকা + বর্তমান মান (তালিকার বাইরে হলে শুরুতে যোগ) */
export function timezoneChoices(current: string): string[] {
  const base: string[] = [...TIMEZONE_CHOICES];
  return base.includes(current) ? base : [current, ...base];
}

const THEME_MARK = /var DEFAULT_THEME = "[a-z]+";/;

/**
 * `public/theme-init.js`-এর default-থিম build-সময়ে বদলানো (নতুন request/layout-পরিবর্তন ছাড়া)।
 * marker না পেলে throw — নীরবে ভুল default নয়।
 */
export function applyDefaultTheme(src: string, theme: Theme): string {
  if (!THEME_MARK.test(src)) throw new Error("theme-init.js-এ DEFAULT_THEME marker নেই");
  return src.replace(THEME_MARK, `var DEFAULT_THEME = "${theme}";`);
}
