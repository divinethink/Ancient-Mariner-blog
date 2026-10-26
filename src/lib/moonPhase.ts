// চাঁদের কলা (pure, SDK/UI-মুক্ত): "YYYY-MM-DD" → আলোকিত অংশ। গড় সিনোডিক-মাস ধরে হিসাব (±~১ দিন) — শুধু সাজসজ্জার জন্য যথেষ্ট।
const SYNODIC = 29.530588853;
const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const DAY_MS = 86_400_000;

export type MoonKind = "new" | "waxing" | "full" | "waning";

/** 0 = অমাবস্যা, 0.5 = পূর্ণিমা, [0,1)। অবৈধ তারিখে null */
export function moonFraction(day: string): number | null {
  const t = new Date(`${day}T12:00:00Z`).getTime();
  if (Number.isNaN(t)) return null;
  return ((((t - REF_NEW_MOON) / DAY_MS) % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC;
}

/** আলোকিত অংশ, ০–১০০ (পূর্ণসংখ্যা) */
export const moonIllumination = (f: number): number => Math.round(((1 - Math.cos(2 * Math.PI * f)) / 2) * 100);

export const moonKind = (f: number): MoonKind => (f < 0.03 || f > 0.97 ? "new" : f < 0.47 ? "waxing" : f < 0.53 ? "full" : "waning");

/** ১০০×১০০ viewBox-এ আলোকিত অংশের SVG path (শুক্লপক্ষে ডানে, কৃষ্ণপক্ষে বামে আলো) */
export function moonPathD(f: number, r = 44, c = 50): string {
  const k = Math.cos(2 * Math.PI * f);
  const rx = (Math.abs(k) * r).toFixed(2);
  if (f < 0.5) return `M${c} ${c - r}A${r} ${r} 0 0 1 ${c} ${c + r}A${rx} ${r} 0 0 ${k > 0 ? 0 : 1} ${c} ${c - r}Z`;
  return `M${c} ${c - r}A${r} ${r} 0 0 0 ${c} ${c + r}A${rx} ${r} 0 0 ${k > 0 ? 1 : 0} ${c} ${c - r}Z`;
}
