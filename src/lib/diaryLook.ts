// দিনলিপির চেহারা: থিম · ফন্ট · লেখার আকার (pure, SDK/UI-মুক্ত)। অজানা/অবৈধ মান সবসময় ডিফল্টে ফেরে —
// পুরনো ডেটা বা ভবিষ্যতে সরানো থিম পেজ ভাঙে না। CSS `globals.css`-এর `[data-dtheme|dfont|dsize]` নিয়মের সাথে মিলিয়ে রাখতে হবে।
export const DIARY_THEMES = ["paper", "night", "dot", "letter", "rose", "oyster", "terracotta", "slate"] as const;
export const DIARY_FONTS = ["default", "charulipi", "rabindric", "tagore", "bensen", "kaiyum"] as const;
export const DIARY_SIZES = ["s", "m", "l"] as const;

export type DiaryTheme = (typeof DIARY_THEMES)[number];
export type DiaryFont = (typeof DIARY_FONTS)[number];
export type DiarySize = (typeof DIARY_SIZES)[number];
export type DiaryLook = { theme: DiaryTheme; font: DiaryFont; size: DiarySize };

export const DEFAULT_DIARY_LOOK: DiaryLook = { theme: "paper", font: "default", size: "m" };

/** পিকারের রঙের নমুনা (CSS-এর সাথে মেলানো): পটভূমি + কালি */
export const DIARY_SWATCH: Record<DiaryTheme, { bg: string; ink: string }> = {
  paper: { bg: "#fbf3dc", ink: "#8a3b2e" },
  night: { bg: "#1f2230", ink: "#d9b36a" },
  dot: { bg: "#f5f2ea", ink: "#1d3a6b" },
  letter: { bg: "#ecdcbd", ink: "#7a3d1c" },
  rose: { bg: "#f9cfc7", ink: "#8a2f26" },
  oyster: { bg: "#dedbd3", ink: "#7a5230" },
  terracotta: { bg: "#f3e9d9", ink: "#a1472f" },
  slate: { bg: "#f7f3e9", ink: "#4f5f41" },
};

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;

/** যেকোনো কাঁচা মান (JSON/localStorage) → বৈধ চেহারা; প্রতিটি ফিল্ড আলাদাভাবে `base`-এ ফেরে */
export function parseDiaryLook(raw: unknown, base: DiaryLook = DEFAULT_DIARY_LOOK): DiaryLook {
  const o = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    theme: pick(DIARY_THEMES, o.theme, base.theme),
    font: pick(DIARY_FONTS, o.font, base.font),
    size: pick(DIARY_SIZES, o.size, base.size),
  };
}

/** সাইট-সেটিংসের ঐচ্ছিক ফিল্ড (diaryTheme/diaryFont/diarySize) → চেহারা; না থাকলে ডিফল্ট */
export const lookFromSettings = (s: { diaryTheme?: string; diaryFont?: string; diarySize?: string }): DiaryLook =>
  parseDiaryLook({ theme: s.diaryTheme, font: s.diaryFont, size: s.diarySize });

export const sameLook = (a: DiaryLook, b: DiaryLook): boolean => a.theme === b.theme && a.font === b.font && a.size === b.size;
