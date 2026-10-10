// Diary-র pure অংশ (SDK/UI-মুক্ত; P8a-১): দিন-key গণিত, মাসের ছক, 'এই দিনে', সাধারণ-লেখা → Tiptap doc।
// 'দিন' = সাইট-timezone-এর "YYYY-MM-DD" (`datetime.dayKey`); এখানে শুধু string/UTC-গণিত, তাই timezone-নিরপেক্ষ।
import type { DocNode } from "./editorDoc";

export const DIARY_TEXT_MAX = 5000;
export const ON_THIS_DAY_YEARS = 5;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, "0");

/** বাস্তব তারিখ কিনা (যেমন 2026-02-30 অবৈধ) */
export function isValidDayKey(s: string): boolean {
  const m = DAY_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** "YYYY-MM-DD" → "YYYY-MM" */
export const monthOf = (dayKey: string): string => dayKey.slice(0, 7);

/** মাস ± n ("YYYY-MM"); অবৈধ ইনপুটে অপরিবর্তিত */
export function shiftMonth(ym: string, delta: number): string {
  const m = MONTH_RE.exec(ym);
  if (!m) return ym;
  const t = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + delta, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
}

/** মাসের query-সীমা (string-তুলনা): `-31` পরের মাসের আগেই থামে, তাই সব মাসে নিরাপদ */
export const monthRange = (ym: string): [string, string] => [`${ym}-01`, `${ym}-31`];

export type CalCell = { day: number; key: string } | null;

/** মাসের ছক: সপ্তাহ রবি থেকে; আগে/পরে খালি ঘর (null)। প্রতি সারি ৭টা */
export function monthGrid(ym: string): CalCell[][] {
  const m = MONTH_RE.exec(ym);
  if (!m) return [];
  const [y, mo] = [Number(m[1]), Number(m[2])];
  const lead = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const cells: CalCell[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push({ day: d, key: `${ym}-${pad(d)}` });
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: CalCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** 'এই দিনে': আজকের MM-DD-র আগের ১..`years` বছরের দিন-key (২৯ ফেব্রুয়ারি অ-লিপ বছরে বাদ) */
export function onThisDayKeys(today: string, years = ON_THIS_DAY_YEARS): string[] {
  const m = DAY_RE.exec(today);
  if (!m) return [];
  const y = Number(m[1]);
  const out: string[] = [];
  for (let n = 1; n <= years; n++) {
    const key = `${y - n}-${m[2]}-${m[3]}`;
    if (isValidDayKey(key)) out.push(key);
  }
  return out;
}

/** সাধারণ-লেখা → Tiptap doc: প্রতি লাইন একটা paragraph (খালি লাইন = খালি paragraph); শুরু/শেষের ফাঁকা বাদ */
export function textToDoc(text: string): DocNode {
  const lines = text.replace(/\r\n?/g, "\n").trim().split("\n");
  return {
    type: "doc",
    content: lines.map((l) => (l.trim() === "" ? { type: "paragraph" } : { type: "paragraph", content: [{ type: "text", text: l }] })),
  };
}

/** diary entry-র তালিকা-ক্রম: নতুন আগে (updatedAt) */
export const byNewest = <T extends { updatedAt: Date }>(a: T, b: T): number => b.updatedAt.getTime() - a.updatedAt.getTime();
