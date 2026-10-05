// Slug নিয়ম (Arch §৬): Unicode-preserving (বাংলা অক্ষর রাখা), শুধু অক্ষর/চিহ্ন/সংখ্যা ও '-'।
// ZWJ/ZWNJ বাদ — URL-এ অদৃশ্য অক্ষর ঝুঁকিপূর্ণ; হসন্ত-যুক্ত যুক্তাক্ষর তাতে ভাঙে না।
// SDK/UI-মুক্ত (lib purity)।
export const MAX_SLUG_LENGTH = 80;

const VIRAMA = /[\u094d\u09cd\u0a4d\u0acd\u0b4d\u0bcd\u0c4d\u0ccd\u0d4d]/;
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const bn = (n: number) => String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

export function slugify(input: string): string {
  const s = input
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\u200c\u200d]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  const chars = Array.from(s);
  let end = Math.min(MAX_SLUG_LENGTH, chars.length);
  // কার-চিহ্ন ও হসন্ত-যুক্তাক্ষর মাঝখানে না কাটা
  while (end < chars.length && (/\p{M}/u.test(chars[end]) || VIRAMA.test(chars[end - 1]))) end++;
  return chars.slice(0, end).join("").replace(/-+$/, "");
}

export const isValidSlug = (s: string): boolean => s.length > 0 && slugify(s) === s;

/** শিরোনাম থেকে slug না বানানো গেলে (খালি/শুধু চিহ্ন) */
export const fallbackSlug = (postId: string): string => `post-${postId.slice(0, 8).toLowerCase()}`;

/** সংঘাতে suffix: base-২, base-৩ … (Arch §১৭ P3c-র মতো) */
export const withSuffix = (base: string, n: number): string => (n <= 1 ? base : `${base}-${bn(n)}`);

export type SlugClaim = "create" | "owned" | "taken";

/** `slugs/{slug}` lock-এর বর্তমান মালিক দেখে সিদ্ধান্ত: নেই → create; নিজের → owned (retry-নিরাপদ); অন্যের → taken */
export function decideSlugClaim(existingPostId: string | null, postId: string): SlugClaim {
  if (existingPostId === null) return "create";
  return existingPostId === postId ? "owned" : "taken";
}

/** rename-এ পুরনো slug history-তে; নতুন slug history থেকে বাদ; ডুপ্লিকেট নেই */
export function nextHistory(history: readonly string[], oldSlug: string, newSlug: string): string[] {
  return [...new Set([...history, oldSlug])].filter((s) => s !== newSlug);
}
