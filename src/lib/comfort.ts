// লেখার ঘরের আরাম-সেটিং ও থিম-পছন্দের pure যুক্তি (Arch §১১) — SDK/UI-মুক্ত।
// অবৈধ/ভাঙা মান সবসময় default-এ ফেরে (defensive read)।
import { z } from "zod";

export const FONTS = ["serif", "sans"] as const;
export const WIDTHS = [560, 680, 860] as const;
export const SIZE_RANGE = { min: 16, max: 26 } as const;
/** লাইনের ফাঁক দশমাংশে (১৫–২৪ = ১.৫–২.৪) — slider-এ পূর্ণসংখ্যা */
export const LINE_RANGE = { min: 15, max: 24 } as const;

export const ComfortSchema = z.object({
  font: z.enum(FONTS).catch("serif"),
  size: z.number().int().min(SIZE_RANGE.min).max(SIZE_RANGE.max).catch(19),
  line: z.number().int().min(LINE_RANGE.min).max(LINE_RANGE.max).catch(19),
  width: z.union([z.literal(560), z.literal(680), z.literal(860)]).catch(680),
});
export type Comfort = z.infer<typeof ComfortSchema>;

export const DEFAULT_COMFORT: Comfort = { font: "serif", size: 19, line: 19, width: 680 };

/** সংরক্ষিত JSON string (বা যেকোনো মান) → বৈধ Comfort */
export function parseComfort(raw: unknown): Comfort {
  let v: unknown = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      return DEFAULT_COMFORT;
    }
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return DEFAULT_COMFORT;
  return ComfortSchema.parse(v);
}

/** <html>-এ বসার CSS variable (style.setProperty — CSP-নিরাপদ) */
export function comfortVars(c: Comfort): Record<string, string> {
  return {
    "--ff": c.font === "sans" ? "var(--font-sans)" : "var(--font-serif)",
    "--fs": `${c.size}px`,
    "--lh": String(c.line / 10),
    "--mw": `${c.width}px`,
  };
}

export const THEME_PREFS = ["auto", "light", "dark"] as const; // Sepia/Warm/AMOLED P7b
export type ThemePref = (typeof THEME_PREFS)[number];

// public/theme-init.js ও tokens.css-এর --bg-র সাথে মিলিয়ে রাখতে হবে (theme-color meta)
export const THEME_BG: Record<string, string> = {
  light: "#faf9f5",
  sepia: "#f4ecd8",
  warm: "#f7e0bc",
  dark: "#1c1b19",
  amoled: "#000000",
};

/** পছন্দ (auto সহ) → বাস্তব থিম; অচেনা মান light */
export function resolveTheme(pref: string | null | undefined, systemDark: boolean): string {
  const p = pref ?? "light";
  const t = p === "auto" ? (systemDark ? "dark" : "light") : p;
  return t in THEME_BG ? t : "light";
}
