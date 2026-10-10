// Scheduled publish-এর বিশুদ্ধ যুক্তি (Arch §১৭ P11c-১)। SDK/UI-মুক্ত; সময় সংরক্ষণ UTC, ইনপুট সাইট-timezone-এ।
import { fromZonedInput } from "./datetime";

/** Cron ~১৫ মিনিটে চলে; এর কম ব্যবধানের সময় বাছাই অর্থহীন */
export const MIN_LEAD_MS = 60_000;
/** এক Cron-চালনায় সর্বোচ্চ কতটা publish (Workers Free subrequest-বাজেট: ৪৫) */
export const MAX_PUBLISH_PER_RUN = 10;
/** পুরো ভারী-কাজের (trash/prune/D1) ৬-ঘণ্টা স্লট: UTC ঘণ্টা %৬==০ ও প্রথম ১৫ মিনিট */
export const isHeavySlot = (nowMs: number): boolean => {
  const d = new Date(nowMs);
  return d.getUTCHours() % 6 === 0 && d.getUTCMinutes() < 15;
};

export type ScheduleResult = { ok: true; date: Date } | { ok: false; reason: "invalid" | "past" | "empty" };

export function parseScheduleInput(input: string, now: number, timeZone?: string): ScheduleResult {
  if (input.trim() === "") return { ok: false, reason: "empty" };
  const d = fromZonedInput(input, timeZone);
  if (!d) return { ok: false, reason: "invalid" };
  if (d.getTime() < now + MIN_LEAD_MS) return { ok: false, reason: "past" };
  return { ok: true, date: d };
}

export type ScheduledRow = { id: string; scheduledAt?: Date };

/** `scheduledAt <= now` এমন (পুরনো আগে), সর্বোচ্চ `limit`টা; `scheduledAt` বিকৃত/নেই = বাদ (কখনো আন্দাজে publish নয়) */
export function selectDue<T extends ScheduledRow>(rows: readonly T[], now: number, limit = MAX_PUBLISH_PER_RUN): T[] {
  return rows
    .filter((r): r is T & { scheduledAt: Date } => r.scheduledAt instanceof Date && !Number.isNaN(r.scheduledAt.getTime()) && r.scheduledAt.getTime() <= now)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    .slice(0, limit);
}
