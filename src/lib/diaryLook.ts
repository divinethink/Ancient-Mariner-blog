// দিনলিপির চেহারা: থিম · ফন্ট · লেখার আকার (pure, SDK/UI-মুক্ত)। অজানা/অবৈধ মান সবসময় ডিফল্টে ফেরে —
// পুরনো ডেটা বা ভবিষ্যতে সরানো থিম পেজ ভাঙে না। CSS `globals.css`-এর `[data-dtheme|dfont|dsize]` নিয়মের সাথে মিলিয়ে রাখতে হবে।
export const DIARY_THEMES_NEW = ["charcoal", "brick", "forest", "sky", "ink", "nbred", "nbbig", "week"] as const;
/** বিশেষ থিম: রঙের বাইরে সাজসজ্জা (চাঁদ/ডাকঘর/লণ্ঠন/কুয়াশা) — তারিখ · স্থান · বেলা থেকে নিজে সাজে, নতুন ডেটা লাগে না */
export const DIARY_THEMES_SPECIAL = ["moon", "postcard", "lantern", "fog"] as const;
export const DIARY_THEMES = [...DIARY_THEMES_NEW, ...DIARY_THEMES_SPECIAL] as const;
export const DIARY_FONTS = ["default", "rabindric", "tagore", "bensen"] as const;
export const DIARY_SIZES = ["s", "m", "l"] as const;

export type DiaryTheme = (typeof DIARY_THEMES)[number];
export type DiaryFont = (typeof DIARY_FONTS)[number];
export type DiarySize = (typeof DIARY_SIZES)[number];
export type DiaryLook = { theme: DiaryTheme; font: DiaryFont; size: DiarySize };

export const DEFAULT_DIARY_LOOK: DiaryLook = { theme: "nbred", font: "default", size: "m" };

/** পিকারের রঙের নমুনা (CSS-এর সাথে মেলানো): পটভূমি + কালি */
export const DIARY_SWATCH: Record<DiaryTheme, { bg: string; ink: string }> = {
  charcoal: { bg: "#3c4049", ink: "#fdf8ec" },
  brick: { bg: "#8b3a2f", ink: "#fdf8ec" },
  forest: { bg: "#2f6345", ink: "#fdf8ec" },
  sky: { bg: "#466190", ink: "#fdf8ec" },
  ink: { bg: "#181b22", ink: "#b5b5b5" },
  nbred: { bg: "#f9efdc", ink: "#8b3a2f" },
  nbbig: { bg: "#f9efdc", ink: "#8b3a2f" },
  week: { bg: "#fafaf7", ink: "#1d1d1d" },
  moon: { bg: "#0d1030", ink: "#ffe9a8" },
  postcard: { bg: "#efe3c9", ink: "#7a2418" },
  lantern: { bg: "#0b0806", ink: "#ffb35c" },
  fog: { bg: "#dfe7ee", ink: "#2c3e50" },
};

/** পাতার গড়ন (CSS `[data-dlayout]`) */
export type DiaryLayout = "band" | "frame" | "book" | "week" | "deco";
export const DIARY_LAYOUT: Record<DiaryTheme, DiaryLayout> = {
  charcoal: "band", brick: "band", forest: "band", sky: "band",
  ink: "frame",
  nbred: "book", nbbig: "book",
  week: "week",
  moon: "deco", postcard: "deco", lantern: "deco", fog: "deco",
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
