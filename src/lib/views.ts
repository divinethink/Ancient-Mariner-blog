// view-গণনার pure যুক্তি (P11a-১; Arch §৭) — SDK/UI-মুক্ত। কাঁচা IP/UA কখনো সংরক্ষিত হয় না, শুধু দৈনিক salted hash।
import { isValidPostId } from "./id";

export const REFERRER_MAX = 100;
/** একজন ভিজিটর (hash) দিনে সর্বোচ্চ এতগুলো ভিন্ন পোস্টের ভিউ গণ্য — স্প্যাম-সীমা */
export const MAX_POSTS_PER_VISITOR_PER_DAY = 40;
export const DIRECT = "direct";
export const UNKNOWN_COUNTRY = "XX";

export type ViewPayload = { postId: string; referrer: string };

const HOST = /^[a-z0-9]([a-z0-9.-]{0,98}[a-z0-9])?$/;

/** beacon-এর referrer (hostname বা পূর্ণ URL) → lowercase hostname; নিজের host/খালি/অবৈধ = 'direct' */
export function normalizeReferrer(raw: unknown, ownHost?: string): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 300) return DIRECT;
  let h = raw.trim().toLowerCase();
  try {
    if (h.includes("://")) h = new URL(h).hostname;
  } catch {
    return DIRECT;
  }
  h = h.replace(/^www\./, "");
  if (h.length > REFERRER_MAX || !HOST.test(h)) return DIRECT;
  const own = ownHost?.toLowerCase().replace(/^www\./, "");
  return own && h === own ? DIRECT : h;
}

/** অবৈধ হলে null */
export function parseViewPayload(raw: unknown, ownHost?: string): ViewPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.postId !== "string" || !isValidPostId(o.postId)) return null;
  return { postId: o.postId, referrer: normalizeReferrer(o.referrer, ownHost) };
}

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|curl|wget|python|node-fetch|axios|java\/|go-http|okhttp|monitor|facebookexternalhit|embedly|whatsapp|telegram/i;
/** খালি বা পরিচিত bot/tool UA ⇒ true */
export const isBotUa = (ua: string | null | undefined): boolean => !ua || ua.length < 8 || BOT.test(ua);

/** Cloudflare-দেওয়া দেশ-কোড; অবৈধ/না পেলে 'XX' */
export const normalizeCountry = (c: string | null | undefined): string => (c && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : UNKNOWN_COUNTRY);

/** SHA-256(salt|ip|ua|day) → ৩২ হেক্স; ঐ দিনের dedupe-র জন্য, ফেরানো যায় না */
export async function visitorHash(salt: string, ip: string, ua: string, day: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${ip}|${ua}|${day}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const visitorKey = (h: string): string => `v:${h}`;
export const postViewKey = (postId: string, h: string): string => `p:${postId}:${h}`;
