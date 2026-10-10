// পাঠক-টুলের pure যুক্তি (P10b-২, P12-১) — SDK/UI-মুক্ত। অবৈধ মান সবসময় default-এ ফেরে।
import { type FontId, isFontId } from "./fonts";

export const READER_SIZES = ["s", "m", "l"] as const;
export type ReaderSize = (typeof READER_SIZES)[number];
export const DEFAULT_READER_SIZE: ReaderSize = "m";
export const READER_SIZE_KEY = "readerSize"; // public/theme-init.js-ও এই key পড়ে

export function resolveReaderSize(raw: unknown): ReaderSize {
  return (READER_SIZES as readonly unknown[]).includes(raw) ? (raw as ReaderSize) : DEFAULT_READER_SIZE;
}

// P12-১: পাঠকের ফন্ট (খালি/অবৈধ = সাইটের নিজস্ব ফন্ট, data-rfont বসে না); public/theme-init.js-ও এই key পড়ে
export const READER_FONT_KEY = "readerFont";
export function resolveReaderFont(raw: unknown): FontId | "" {
  return isFontId(raw) ? raw : "";
}

// উদ্ধৃতি-শেয়ার (P12-১): নির্বাচিত লেখা — শুধু plain text, লেখার ভেতরের নির্বাচনে
export const QUOTE_MIN = 8;
export const QUOTE_MAX = 600;

/** whitespace গুটিয়ে trim; খুব ছোট/বড় (অক্ষর-গণনা, যুক্তাক্ষর-সহ code point) হলে null */
export function cleanQuote(raw: string): string | null {
  const q = raw.replace(/\s+/g, " ").trim();
  const n = [...q].length;
  return n >= QUOTE_MIN && n <= QUOTE_MAX ? q : null;
}

/** কপি/নেটিভ-শেয়ারের লেখা: “উদ্ধৃতি” — শিরোনাম + (থাকলে) লিংক */
export function quoteShareText(quote: string, title: string, url?: string): string {
  return `\u201C${quote}\u201D \u2014 ${title}${url ? `\n${url}` : ""}`;
}

/** Facebook sharer + quote; পাতার URL অবৈধ হলে null */
export function facebookQuoteUrl(pageUrl: string | undefined, quote: string): string | null {
  const base = facebookShareUrl(pageUrl);
  return base ? `${base}&quote=${encodeURIComponent(quote)}` : null;
}

export type Rect = { top: number; bottom: number; left: number; right: number };
/** পপ-আপের fixed-অবস্থান: ডেস্কটপে নির্বাচনের ওপরে (জায়গা না থাকলে নিচে); টাচে নিচে (নেটিভ মেনু ওপরে আসে) — সবসময় viewport-এর ভেতরে */
export function quotePopupPos(r: Rect, vw: number, vh: number, coarse: boolean, w = 200, h = 48, margin = 8): { top: number; left: number } {
  const above = r.top - h - margin;
  const below = r.bottom + (coarse ? 28 : margin);
  let top = coarse ? below : above >= margin ? above : below;
  if (top + h > vh - margin) top = Math.max(margin, above);
  const left = Math.min(Math.max(margin, (r.left + r.right) / 2 - w / 2), Math.max(margin, vw - w - margin));
  return { top: Math.round(top), left: Math.round(left) };
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
