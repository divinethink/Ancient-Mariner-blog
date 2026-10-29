// কভার-ক্রপ (পাবলিকে দেখানোর কাটা): মূল ছবি কখনো বদলায় না — শুধু CSS (aspect-ratio + object-position)।
// ফিল্ড না থাকা = পুরো ছবি (আগের আচরণ), তাই পুরনো লেখা অক্ষত।
export const COVER_RATIOS = ["16:9", "2:1", "3:1", "4:1", "4:3", "1:1"] as const;
export const COVER_FOCUS = ["start", "center", "end"] as const;
export type CoverRatio = (typeof COVER_RATIOS)[number];
export type CoverFocus = (typeof COVER_FOCUS)[number];
export type CoverCrop = { ratio: CoverRatio; focus: CoverFocus };

export const isCoverRatio = (v: unknown): v is CoverRatio => typeof v === "string" && (COVER_RATIOS as readonly string[]).includes(v);
export const isCoverFocus = (v: unknown): v is CoverFocus => typeof v === "string" && (COVER_FOCUS as readonly string[]).includes(v);

/** অচেনা/বিকৃত হলে undefined (= পুরো ছবি) */
export function toCoverCrop(v: unknown): CoverCrop | undefined {
  if (!v || typeof v !== "object") return undefined;
  const { ratio, focus } = v as Record<string, unknown>;
  return isCoverRatio(ratio) && isCoverFocus(focus) ? { ratio, focus } : undefined;
}

export const sameCrop = (a: CoverCrop | null | undefined, b: CoverCrop | null | undefined): boolean => (a?.ratio ?? "") === (b?.ratio ?? "") && (a?.focus ?? "") === (b?.focus ?? "");

const POS = { start: "0% 0%", center: "50% 50%", end: "100% 100%" } as const;

/** inline style: ratio থাকলে aspect-ratio; focus সবসময় object-position (কাটা যে অক্ষে হয় শুধু সেটাই কাজ করে) */
export function cropStyle(c: CoverCrop | undefined): { aspectRatio?: string; objectPosition?: string } {
  if (!c) return {};
  return { aspectRatio: c.ratio.replace(":", " / "), objectPosition: POS[c.focus] };
}
