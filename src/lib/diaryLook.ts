// দিনলিপির চেহারা: থিম · ফন্ট · লেখার আকার (pure, SDK/UI-মুক্ত)। অজানা/অবৈধ মান সবসময় ডিফল্টে ফেরে —
// পুরনো ডেটা বা ভবিষ্যতে সরানো থিম পেজ ভাঙে না। CSS `globals.css`-এর `[data-dtheme|dfont|dsize]` নিয়মের সাথে মিলিয়ে রাখতে হবে।
export const DIARY_THEMES_NEW = ["charcoal", "brick", "navy", "forest", "sky", "plum", "ink", "gold", "ruby", "teal", "nbslate", "nbred", "nbteal", "nbbig", "week"] as const;
/** বিশেষ থিম: রঙের বাইরে সাজসজ্জা (চাঁদ/ডাকঘর/বৃষ্টি/কাঁথা/আকাশ/লণ্ঠন) — তারিখ · স্থান · বেলা থেকে নিজে সাজে, নতুন ডেটা লাগে না */
export const DIARY_THEMES_SPECIAL = ["moon", "postcard", "rain", "kantha", "skyday", "lantern"] as const;
export const DIARY_THEMES = [...DIARY_THEMES_NEW, ...DIARY_THEMES_SPECIAL] as const;
export const DIARY_FONTS = ["default", "charulipi", "rabindric", "tagore", "bensen", "kaiyum"] as const;
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
  navy: { bg: "#25406e", ink: "#fdf8ec" },
  forest: { bg: "#2f6345", ink: "#fdf8ec" },
  sky: { bg: "#466190", ink: "#fdf8ec" },
  plum: { bg: "#1f1a27", ink: "#b79ac0" },
  ink: { bg: "#181b22", ink: "#b5b5b5" },
  gold: { bg: "#1b1f2b", ink: "#d9b36a" },
  ruby: { bg: "#fafaf7", ink: "#8a3328" },
  teal: { bg: "#fafaf7", ink: "#1f6e75" },
  nbslate: { bg: "#f9efdc", ink: "#3c4049" },
  nbred: { bg: "#f9efdc", ink: "#8b3a2f" },
  nbteal: { bg: "#f9efdc", ink: "#1f6e75" },
  nbbig: { bg: "#f9efdc", ink: "#8b3a2f" },
  week: { bg: "#fafaf7", ink: "#1d1d1d" },
  moon: { bg: "#0d1030", ink: "#ffe9a8" },
  postcard: { bg: "#efe3c9", ink: "#7a2418" },
  rain: { bg: "#0f2a2f", ink: "#7be0d6" },
  kantha: { bg: "#f6efe0", ink: "#c4372f" },
  skyday: { bg: "#8a2f7b", ink: "#ffe6a4" },
  lantern: { bg: "#0b0806", ink: "#ffb35c" },
};

/** পাতার গড়ন (CSS `[data-dlayout]`) */
export type DiaryLayout = "band" | "frame" | "line" | "book" | "week" | "deco";
export const DIARY_LAYOUT: Record<DiaryTheme, DiaryLayout> = {
  charcoal: "band", brick: "band", navy: "band", forest: "band", sky: "band",
  plum: "frame", ink: "frame", gold: "frame",
  ruby: "line", teal: "line",
  nbslate: "book", nbred: "book", nbteal: "book", nbbig: "book",
  week: "week",
  moon: "deco", postcard: "deco", rain: "deco", kantha: "deco", skyday: "deco", lantern: "deco",
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
