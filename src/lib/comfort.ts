// লেখার ঘরের আরাম-সেটিং ও থিম-পছন্দের pure যুক্তি (Arch §১১) — SDK/UI-মুক্ত।
// অবৈধ/ভাঙা মান সবসময় default-এ ফেরে (defensive read)।
import { z } from "zod";
import { PALETTE_BG, type Palette } from "./design";
import { FONT_IDS, fontStack } from "./fonts";

export const FONTS = FONT_IDS;
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
    "--ff": fontStack(c.font),
    "--fs": `${c.size}px`,
    "--lh": String(c.line / 10),
    "--mw": `${c.width}px`,
  };
}

export const THEME_PREFS = ["auto", "light", "sepia", "warm", "dark", "amoled"] as const;
export type ThemePref = (typeof THEME_PREFS)[number];

// public/theme-init.js ও tokens.css-এর --bg-র সাথে মিলিয়ে রাখতে হবে (theme-color meta)
export const THEME_BG: Record<string, string> = {
  light: "#faf9f5",
  sepia: "#f4ecd8",
  warm: "#f7e8d0",
  dark: "#1c1b19",
  amoled: "#000000",
};

/** theme-color meta-র রং: সাইটের প্যালেট (শুধু light/dark-এ) নইলে THEME_BG */
export function themeColor(t: string, palette: string | null | undefined): string {
  const pb = palette && palette !== "classic" ? PALETTE_BG[palette as Exclude<Palette, "classic">] : undefined;
  const fromPalette = pb && (t === "light" || t === "dark") ? pb[t] : undefined;
  return fromPalette ?? THEME_BG[t] ?? THEME_BG.light!;
}

/** Typewriter scroll: caret যেখানে থাকতে চায় (viewport-উচ্চতার অনুপাত) */
export const TYPEWRITER_RATIO = 0.4;
/** caret-এর উপরের প্রান্ত (viewport-এর সাপেক্ষে) → কত px scroll করলে লক্ষ্যে পৌঁছায়; সহনসীমার ভেতরে বা অবৈধ মানে ০ (jitter এড়াতে) */
export function typewriterDelta(
  caretTop: number,
  viewportH: number,
  ratio = TYPEWRITER_RATIO,
  tol = 24,
): number {
  if (!Number.isFinite(caretTop) || !Number.isFinite(viewportH) || viewportH <= 0) return 0;
  const d = caretTop - viewportH * ratio;
  return Math.abs(d) <= tol ? 0 : Math.round(d);
}

/** পছন্দ (auto সহ) → বাস্তব থিম; অচেনা মান light */
export function resolveTheme(pref: string | null | undefined, systemDark: boolean): string {
  const p = pref ?? "light";
  const t = p === "auto" ? (systemDark ? "dark" : "light") : p;
  return t in THEME_BG ? t : "light";
}
