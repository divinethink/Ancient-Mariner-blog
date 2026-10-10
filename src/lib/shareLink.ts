// Share-link-এর বিশুদ্ধ যুক্তি (Arch §১৭ P11c-২)। SDK/UI-মুক্ত। token কখনো সংরক্ষিত নয় — শুধু SHA-256 hash (doc-ID)।

/** ৩২ বাইট র‍্যান্ডম → base64url (padding ছাড়া) = ৪৩ অক্ষর */
export const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
export const SHARE_EXPIRY_DAYS = [1, 7, 30] as const;
export const SHARE_DEFAULT_DAYS = 7;
export const SHARE_PATH = "/share";
const DAY_MS = 86_400_000;

export type ShareState = "active" | "expired" | "revoked";

/** revoke আগে দেখা হয় (মেয়াদ থাকলেও revoked = revoked); `expiresAt <= now` = expired */
export function shareState(link: { expiresAt: Date; revokedAt?: Date }, now: number): ShareState {
  if (link.revokedAt) return "revoked";
  return link.expiresAt.getTime() <= now ? "expired" : "active";
}

export function expiryFrom(now: number, days: number): Date {
  const d = (SHARE_EXPIRY_DAYS as readonly number[]).includes(days) ? days : SHARE_DEFAULT_DAYS;
  return new Date(now + d * DAY_MS);
}

export const shareUrl = (origin: string, token: string): string => `${origin.replace(/\/+$/, "")}${SHARE_PATH}/${token}`;
