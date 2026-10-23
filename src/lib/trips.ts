// ঘোরার তালিকা (দিনলিপি-চ): pure (SDK/UI-মুক্ত)। খরচ = পূর্ণসংখ্যা টাকা (Dev Rules §১৪ — floating নয়); তারিখ শুধু দিন-key।
export const TRIP_PLACE_MAX = 100;
export const TRIP_NOTE_MAX = 2000;
export const TRIP_COST_MAX = 100_000_000;
export const TRIP_LIST_MAX = 300;

export type TripStatusValue = "wish" | "been";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** টাকার ইনপুট → পূর্ণসংখ্যা। বাংলা/ইংরেজি অঙ্ক, কমা, ফাঁকা ও ৳ চলে; ফাঁকা = খরচ নেই (ok, value নেই); অন্য কিছু (দশমিক, অক্ষর, ঋণাত্মক, সীমা-ছাড়া) = ব্যর্থ */
export function parseCost(raw: string): { ok: true; value?: number } | { ok: false } {
  const s = raw.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d))).replace(/[\s,৳]/g, "");
  if (s === "") return { ok: true };
  if (!/^\d{1,9}$/.test(s)) return { ok: false };
  const n = Number(s);
  return n <= TRIP_COST_MAX ? { ok: true, value: n } : { ok: false };
}

export const formatTaka = (n: number): string => `৳ ${n.toLocaleString("bn-BD")}`;

/** গিয়েছি-ট্রিপগুলোর মোট খরচ (খরচ-না-থাকা বাদ) */
export const totalCost = (trips: readonly { status: string; costTaka?: number | undefined }[]): number =>
  trips.reduce((sum, t) => (t.status === "been" && typeof t.costTaka === "number" ? sum + t.costTaka : sum), 0);

/** গিয়েছি: তারিখ নতুন আগে (তারিখহীন শেষে); যেতে-চাই: যেভাবে এসেছে */
export function sortBeen<T extends { day?: string | undefined }>(trips: readonly T[]): T[] {
  return [...trips].sort((a, b) => (b.day ?? "").localeCompare(a.day ?? ""));
}
