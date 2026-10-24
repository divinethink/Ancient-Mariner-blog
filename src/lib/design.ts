// সাইটের design (accent / ফন্ট-জোড়া / card-ধরন) — Arch §১৭ P9b। pure, SDK/UI-মুক্ত।
// শুধু বন্ধ enum-তালিকা (কোনো custom CSS/hex নেই); অজানা মান শুধু ডিফল্টে ফেরে (defensive read)।
export const PALETTES = ["classic", "slate", "oyster", "midnight", "paper", "nord", "gruvbox", "rosepine", "catppuccin", "dhan", "pradip", "nodi"] as const;
export const ACCENTS = ["terracotta", "teal"] as const;
export const FONT_PAIRS = ["serif-sans", "sans", "serif"] as const;
export const CARD_STYLES = ["outline", "flat", "shadow"] as const;

export type Palette = (typeof PALETTES)[number];
export type Accent = (typeof ACCENTS)[number];
export type FontPair = (typeof FONT_PAIRS)[number];
export type CardStyle = (typeof CARD_STYLES)[number];
export type Design = { palette: Palette; accent: Accent; fontPair: FontPair; cardStyle: CardStyle };

/** ডিফল্ট = আজকের সাইট হুবহু */
export const DEFAULT_DESIGN: Design = { palette: "classic", accent: "terracotta", fontPair: "serif-sans", cardStyle: "outline" };

const pick = <T extends string>(list: readonly T[], v: unknown, d: T): T => (list as readonly string[]).includes(v as string) ? (v as T) : d;

/** যেকোনো ইনপুট থেকে সবসময় বৈধ Design */
export function resolveDesign(raw: unknown): Design {
  const o = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    palette: pick(PALETTES, o.palette, DEFAULT_DESIGN.palette),
    accent: pick(ACCENTS, o.accent, DEFAULT_DESIGN.accent),
    fontPair: pick(FONT_PAIRS, o.fontPair, DEFAULT_DESIGN.fontPair),
    cardStyle: pick(CARD_STYLES, o.cardStyle, DEFAULT_DESIGN.cardStyle),
  };
}

/** সাইটের নাম/স্লোগানের ফন্ট ও সাইজ (সেটিংস; অজানা/অনুপস্থিত = ডিফল্ট ⇒ আজকের চেহারা হুবহু)। শুধু বন্ধ enum — custom CSS নেই। */
export const HEAD_FONTS = ["theme", "serif", "sans", "hind"] as const;
export const HEAD_SIZES = ["sm", "md", "lg"] as const;
export type HeadFont = (typeof HEAD_FONTS)[number];
export type HeadSize = (typeof HEAD_SIZES)[number];
export type DesignHead = { titleFont: HeadFont; titleSize: HeadSize; taglineFont: HeadFont; taglineSize: HeadSize };
export const DEFAULT_HEAD: DesignHead = { titleFont: "theme", titleSize: "md", taglineFont: "theme", taglineSize: "md" };

/** "theme" = থিমের ফন্ট-জোড়া (inline style নেই); বাকিগুলো @fontsource-এ লোড-করা পরিবার */
const HEAD_FAMILY: Record<Exclude<HeadFont, "theme">, string> = {
  serif: '"Noto Serif Bengali", serif',
  sans: '"Noto Sans Bengali", system-ui, sans-serif',
  hind: '"Hind Siliguri", system-ui, sans-serif',
};
export const headFontStyle = (f: HeadFont): { fontFamily: string } | undefined => (f === "theme" ? undefined : { fontFamily: HEAD_FAMILY[f] });

/** logo/banner-এর media-id (P9b-২; খালি = নেই) — Design-এর enum-অংশের বাইরে, কিন্তু একই `siteSettings.design` map-এ */
export type DesignMedia = { logoMediaId: string; bannerMediaId: string };
export const MEDIA_ID_MAX = 128;

/** build-এ আনার media-id (খালি বাদ, ডুপ্লিকেট ছাড়া) */
export function designMediaIds(d: Partial<DesignMedia>): string[] {
  return [...new Set([d.logoMediaId, d.bannerMediaId].filter((x): x is string => !!x))];
}

/** প্যালেটের --bg (theme-color meta-র জন্য; শুধু light/dark — sepia/warm/amoled পাঠ-মোডের পটভূমি থিম-নিরপেক্ষ, শুধু accent থিমের); tokens.css ও public/theme-init.js-এর PBG-র সাথে মেলাতে হয় (design.test.ts মেলায়)। classic = THEME_BG */
export const PALETTE_MODES = ["light", "dark"] as const;
export type PaletteMode = (typeof PALETTE_MODES)[number];
export const PALETTE_BG: Record<Exclude<Palette, "classic">, Record<PaletteMode, string>> = {
  slate: { light: "#f6f5ee", dark: "#171b14" },
  oyster: { light: "#eeece6", dark: "#1d1c1a" },
  midnight: { light: "#f5f2ea", dark: "#0f1a2b" },
  paper: { light: "#fcfcfa", dark: "#121212" },
  nord: { light: "#eceff4", dark: "#2e3440" },
  gruvbox: { light: "#fbf1c7", dark: "#282828" },
  rosepine: { light: "#faf4ed", dark: "#191724" },
  catppuccin: { light: "#eff1f5", dark: "#1e1e2e" },
  dhan: { light: "#f7f4df", dark: "#151a10" },
  pradip: { light: "#f6ebdc", dark: "#1a110a" },
  nodi: { light: "#fbf1ec", dark: "#131c2a" },
};

const DESIGN_MARK = /var DESIGN = \{[^}\n]*\};/;

/**
 * `public/theme-init.js`-এর DESIGN build-সময়ে বদলানো (<html>-এ data-palette/data-accent/data-font/data-card বসে, paint-এর আগে ⇒ FOUC নেই)।
 * মান আগে `resolveDesign`-এ বৈধ করা (injection নেই); marker না পেলে throw — নীরবে ভুল নয়।
 */
export function applyDesign(src: string, design: Design): string {
  if (!DESIGN_MARK.test(src)) throw new Error("theme-init.js-এ DESIGN marker নেই");
  const d = resolveDesign(design);
  return src.replace(DESIGN_MARK, () => `var DESIGN = { palette: "${d.palette}", accent: "${d.accent}", font: "${d.fontPair}", card: "${d.cardStyle}" };`);
}
