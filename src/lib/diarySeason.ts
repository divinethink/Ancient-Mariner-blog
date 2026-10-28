// বাংলা ঋতু অনুযায়ী দিনলিপির থিম (pure, SDK/UI-মুক্ত)। ঋতু-বদল প্রতি দ্বিতীয় মাসের ১৫ তারিখে (আনুমানিক):
// গ্রীষ্ম ১৫ এপ্রিল · বর্ষা ১৫ জুন · শরৎ ১৫ আগস্ট · হেমন্ত ১৫ অক্টোবর · শীত ১৫ ডিসেম্বর · বসন্ত ১৫ ফেব্রুয়ারি।
// অবৈধ/অজানা মান ডিফল্টে ফেরে; কিছু সংরক্ষণ করে না (সংরক্ষণ `useDiaryLook`-এ, এই ডিভাইসে)।
import { DIARY_THEMES, type DiaryTheme } from "./diaryLook";

export const SEASONS = ["grishmo", "borsha", "shorot", "hemonto", "shit", "boshonto"] as const;
export type Season = (typeof SEASONS)[number];

export const DEFAULT_SEASON_THEMES: Record<Season, DiaryTheme> = {
  grishmo: "sky",
  borsha: "forest",
  shorot: "nbred",
  hemonto: "lantern",
  shit: "fog",
  boshonto: "postcard",
};

/** 'YYYY-MM-DD' → ঋতু; অবৈধ হলে null */
export function seasonOf(day: string): Season | null {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const mo = Number(m[1]);
  const d = Number(m[2]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const x = mo * 100 + d;
  if (x >= 1215 || x < 215) return "shit";
  if (x < 415) return "boshonto";
  if (x < 615) return "grishmo";
  if (x < 815) return "borsha";
  if (x < 1015) return "shorot";
  return "hemonto";
}

export type SeasonPref = { on: boolean; map: Record<Season, DiaryTheme> };
export const DEFAULT_SEASON_PREF: SeasonPref = { on: false, map: DEFAULT_SEASON_THEMES };

/** কাঁচা মান (JSON) → বৈধ পছন্দ; প্রতিটি ঋতু আলাদাভাবে ডিফল্টে ফেরে */
export function parseSeasonPref(raw: unknown): SeasonPref {
  const o = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const m = o.map !== null && typeof o.map === "object" ? (o.map as Record<string, unknown>) : {};
  const map = { ...DEFAULT_SEASON_THEMES };
  for (const s of SEASONS) {
    const v = m[s];
    if (typeof v === "string" && (DIARY_THEMES as readonly string[]).includes(v)) map[s] = v as DiaryTheme;
  }
  return { on: o.on === true, map };
}

/** চালু থাকলে আজকের ঋতুর থিম, নইলে `base` */
export function themeFor(pref: SeasonPref, base: DiaryTheme, today: string): DiaryTheme {
  if (!pref.on) return base;
  const s = seasonOf(today);
  return s ? pref.map[s] : base;
}
