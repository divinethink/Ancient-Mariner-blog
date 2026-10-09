// দৈনিক-লেখার-লক্ষ্যের pure যুক্তি (P7a; SDK/UI-মুক্ত)। 'আজকের নতুন শব্দ' = প্রতি লেখার (বর্তমান − দিনের-শুরুর) যোগফল, ঋণাত্মক নয়।
// streak/দিন-গণনা নেই (Mockup §৬ 'শান্ত অনুপ্রেরণা')।
export const DEFAULT_GOAL = 500;

export type GoalEntry = { base: number; cur: number };
export type GoalDay = Record<string, GoalEntry>;

const nonNeg = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);

/** সংরক্ষিত মান (বা যেকোনো কিছু) → বৈধ GoalDay (defensive read) */
export function parseGoalDay(raw: unknown): GoalDay {
  const out: GoalDay = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null) continue;
    const e = v as Record<string, unknown>;
    out[id] = { base: nonNeg(e.base), cur: nonNeg(e.cur) };
  }
  return out;
}

/** একটা লেখার বর্তমান শব্দ-সংখ্যা নথিভুক্ত। দিনে প্রথমবার হলে base = `initial` (editor খোলার সময়ের সংখ্যা) */
export function recordWords(day: GoalDay, postId: string, words: number, initial: number): GoalDay {
  const prev = day[postId];
  return { ...day, [postId]: { base: prev ? prev.base : nonNeg(initial), cur: nonNeg(words) } };
}

/** আজকের নতুন শব্দ */
export const wordsToday = (day: GoalDay): number =>
  Object.values(day).reduce((sum, e) => sum + Math.max(0, e.cur - e.base), 0);

/** ০–১০০ */
export function goalPercent(done: number, goal: number): number {
  if (!(goal > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((done / goal) * 100)));
}

/** তালিকা থেকে একটা এলোমেলো আইটেম, `excludeId` বাদে (একটাই থাকলে সেটাই); খালি হলে undefined */
export function pickRandom<T extends { id: string }>(
  items: readonly T[],
  excludeId?: string,
  rnd: () => number = Math.random,
): T | undefined {
  const pool = items.length > 1 && excludeId ? items.filter((i) => i.id !== excludeId) : items;
  if (pool.length === 0) return undefined;
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
}
