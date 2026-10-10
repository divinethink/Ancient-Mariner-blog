// পাঠক-টুলের pure যুক্তি (P10b-২) — SDK/UI-মুক্ত। অবৈধ মান সবসময় default-এ ফেরে।
export const READER_SIZES = ["s", "m", "l"] as const;
export type ReaderSize = (typeof READER_SIZES)[number];
export const DEFAULT_READER_SIZE: ReaderSize = "m";
export const READER_SIZE_KEY = "readerSize"; // public/theme-init.js-ও এই key পড়ে

export function resolveReaderSize(raw: unknown): ReaderSize {
  return (READER_SIZES as readonly unknown[]).includes(raw) ? (raw as ReaderSize) : DEFAULT_READER_SIZE;
}

/** Facebook share-লিংক; শুধু http(s) পূর্ণ URL, নইলে null (লিংক দেখানো হবে না) */
export function facebookShareUrl(pageUrl: string | undefined): string | null {
  if (!pageUrl) return null;
  try {
    const u = new URL(pageUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u.href)}`;
  } catch {
    return null;
  }
}

/** পূর্ণ লেখার-URL: siteUrl + পথ (siteUrl না থাকলে undefined) */
export function absoluteUrl(siteUrl: string | undefined, path: string): string | undefined {
  if (!siteUrl) return undefined;
  try {
    return new URL(path, siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`).href;
  } catch {
    return undefined;
  }
}
