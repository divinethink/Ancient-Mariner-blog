// Trash নীতি (Arch §৬ Trash): ৭ দিন পর স্থায়ী মোছা। 'এখন' কলার দেয় — render-এ Date.now() নয়।
export const TRASH_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** স্থায়ী মোছার আগে কত দিন বাকি (০–৭, আংশিক দিন উপরে ধরে) */
export function trashDaysLeft(trashedAt: Date, nowMs: number): number {
  const left = Math.ceil((trashedAt.getTime() + TRASH_DAYS * DAY_MS - nowMs) / DAY_MS);
  return Math.min(TRASH_DAYS, Math.max(0, left));
}
