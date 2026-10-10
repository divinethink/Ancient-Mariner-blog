// পাঠকের পড়ার-অগ্রগতি (P12-২) — SDK/UI-মুক্ত pure যুক্তি। শুধু পাঠকের ব্রাউজারে (localStorage); সার্ভার/Firestore-এ কিছু যায় না।
// অবৈধ/নষ্ট মান সবসময় খালি অবস্থায় ফেরে; schema-version v নতুন করে পড়ার সুযোগ রাখে।
export const READ_PROGRESS_KEY = "readProgress";
export const READ_PROGRESS_MAX = 200; // সর্বোচ্চ কত লেখার অবস্থা রাখা হবে (পুরনোগুলো আগে বাদ)
export const RESUME_MIN = 0.05; // এর নিচে = প্রায় শুরুতেই, resume দেখানো হবে না
export const DONE_AT = 0.95; // এর ওপরে = পড়া শেষ, resume নয়

export type ProgressEntry = { p: number; t: number };
export type ProgressMap = Record<string, ProgressEntry>;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** localStorage-এর raw string → বৈধ map (নষ্ট/অচেনা হলে {}) */
export function parseProgress(raw: string | null): ProgressMap {
  if (!raw) return {};
  try {
    const j = JSON.parse(raw) as { v?: unknown; items?: unknown };
    if (j?.v !== 1 || !j.items || typeof j.items !== "object") return {};
    const out: ProgressMap = {};
    for (const [slug, e] of Object.entries(j.items as Record<string, unknown>)) {
      const { p, t } = (e ?? {}) as { p?: unknown; t?: unknown };
      if (typeof p === "number" && Number.isFinite(p) && typeof t === "number" && Number.isFinite(t)) out[slug] = { p: clamp01(p), t };
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeProgress(map: ProgressMap): string {
  return JSON.stringify({ v: 1, items: map });
}

/** একটি লেখার অগ্রগতি বসায় (immutable); সীমা ছাড়ালে সবচেয়ে পুরনো বাদ */
export function recordProgress(map: ProgressMap, slug: string, p: number, now: number): ProgressMap {
  if (!slug || !Number.isFinite(p)) return map;
  const next: ProgressMap = { ...map, [slug]: { p: clamp01(p), t: now } };
  const keys = Object.keys(next);
  if (keys.length > READ_PROGRESS_MAX) {
    keys.sort((a, b) => next[a].t - next[b].t);
    for (const k of keys.slice(0, keys.length - READ_PROGRESS_MAX)) delete next[k];
  }
  return next;
}

/** resume-প্রস্তাব দেওয়া হবে কি? মাঝামাঝি অবস্থানে হলেই (শুরু/শেষ নয়) */
export function resumeFraction(map: ProgressMap, slug: string): number | null {
  const e = map[slug];
  return e && e.p >= RESUME_MIN && e.p < DONE_AT ? e.p : null;
}
