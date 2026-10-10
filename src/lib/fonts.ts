// লেখার-ফন্ট তালিকা (P12-১) — pure, SDK/UI-মুক্ত। লেখার ঘরের আরাম-প্যানেল ও পাঠকের ফন্ট-বাছাই একই তালিকা।
// id 'serif'/'sans' = আগে থেকে সংরক্ষিত comfort-মান (Noto) — তাই পুরনো সেটিং অক্ষত, migration লাগে না।
// ইংরেজি-ফন্ট (Inter/Roboto) শুধু Latin; বাংলা অক্ষর Noto Sans Bengali-তে fallback।
export const FONT_IDS = ["serif", "sans", "hind", "solaiman", "kalpurush", "inter", "roboto"] as const;
export type FontId = (typeof FONT_IDS)[number];
export const DEFAULT_FONT: FontId = "serif";

const BN_FALLBACK = '"Noto Sans Bengali", system-ui, sans-serif';

/** প্রদর্শন-নাম (ফন্টের নিজস্ব নাম — অনুবাদযোগ্য নয়) */
export const FONT_NAME: Record<FontId, string> = {
  serif: "Noto Serif Bengali",
  sans: "Noto Sans Bengali",
  hind: "Hind Siliguri",
  solaiman: "SolaimanLipi",
  kalpurush: "Kalpurush",
  inter: "Inter",
  roboto: "Roboto",
};

/** CSS font-family stack; public globals.css-এর `[data-rfont]` নিয়মের সাথে হুবহু মিলতে হয় (fonts.test.ts যাচাই করে) */
export const FONT_STACK: Record<FontId, string> = {
  serif: '"Noto Serif Bengali", Georgia, serif',
  sans: '"Noto Sans Bengali", system-ui, sans-serif',
  hind: `"Hind Siliguri", ${BN_FALLBACK}`,
  solaiman: `"SolaimanLipi", ${BN_FALLBACK}`,
  kalpurush: `"Kalpurush", ${BN_FALLBACK}`,
  inter: `"Inter", ${BN_FALLBACK}`,
  roboto: `"Roboto", ${BN_FALLBACK}`,
};

export const isFontId = (v: unknown): v is FontId => (FONT_IDS as readonly unknown[]).includes(v);
export const fontStack = (id: FontId): string => FONT_STACK[id];
