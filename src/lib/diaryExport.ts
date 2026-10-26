// দিনলিপি ডাউনলোডের pure অংশ (SDK/UI-মুক্ত): পরিসর, বাছাই, লেখা → লাইন, ফাইলের নাম, পাতার আনুমানিক সংখ্যা।
// শুধু read — কিছু লেখে/মোছে না। PDF = ব্রাউজারের প্রিন্ট (DiaryPrintRoot); Word = `diaryDocx.ts`।
import { bn } from "../i18n/bn";
import { formatDate } from "./datetime";
import { diaryVisOf, isValidDayKey, monthRange } from "./diary";
import { periodOf } from "./diaryPeriod";
import { docToText, parseBody } from "./editorDoc";

export type RangeKind = "day" | "month" | "year" | "all" | "custom";
export type DayRange = { from: string; to: string };

/** এর আগের বছরের দিনলিপি খোঁজা হয় না (সর্বনিম্ন বছর) */
export const MIN_YEAR = 1990;
const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
const dayLbl = (k: string) => `${bnNum(Number(k.slice(8, 10)))} ${bn.diary.months[Number(k.slice(5, 7)) - 1]} ${bnNum(Number(k.slice(0, 4)))}`;

/**
 * পরিসর → দিন-key জোড়া (দুই প্রান্তসহ)। `sel` = ড্যাশবোর্ডে নির্বাচিত দিন; `today` পরিসরের সীমা।
 * অবৈধ হলে null: নির্বাচিত দিন অবৈধ, custom-এ অবৈধ তারিখ/শুরু > শেষ/ভবিষ্যৎ।
 */
export function rangeFor(kind: RangeKind, sel: string, today: string, custom?: { from: string; to: string }): DayRange | null {
  if (kind === "all") return { from: "0000-01-01", to: today };
  if (kind === "custom") {
    const c = custom;
    if (!c || !isValidDayKey(c.from) || !isValidDayKey(c.to) || c.from > c.to || c.to > today) return null;
    return { from: c.from, to: c.to };
  }
  if (!isValidDayKey(sel)) return null;
  if (kind === "day") return { from: sel, to: sel };
  if (kind === "month") {
    const [from, to] = monthRange(sel.slice(0, 7));
    return { from, to };
  }
  const y = sel.slice(0, 4);
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

/** পরিসরের বাংলা নাম (মলাট ও ফাইল-শিরোনামে) */
export function rangeLabel(kind: RangeKind, r: DayRange): string {
  if (kind === "all") return bn.diary.dl.all;
  if (kind === "year") return bnNum(Number(r.from.slice(0, 4)));
  if (kind === "month") return `${bn.diary.months[Number(r.from.slice(5, 7)) - 1]} ${bnNum(Number(r.from.slice(0, 4)))}`;
  return r.from === r.to ? dayLbl(r.from) : `${dayLbl(r.from)} – ${dayLbl(r.to)}`;
}

/** ASCII ফাইল-নাম: dinolipi-2026-10.docx ইত্যাদি */
export function fileName(kind: RangeKind, r: DayRange, ext: "docx" | "pdf"): string {
  const stem =
    kind === "all" ? "all" : kind === "year" ? r.from.slice(0, 4) : kind === "month" ? r.from.slice(0, 7) : kind === "day" || r.from === r.to ? r.from : `${r.from}_${r.to}`;
  return `dinolipi-${stem}.${ext}`;
}

/** পরিসরকে বছরভিত্তিক টুকরো করে (প্রতি টুকরো ≤ ১ বছর ⇒ `listDiary`-র ৫০০-সীমায় কাটে না); `nowYear`-এর পরের বছর বাদ */
export function splitByYear(r: DayRange, nowYear: number): DayRange[] {
  const y0 = Math.max(Number(r.from.slice(0, 4)), MIN_YEAR);
  const y1 = Math.min(Number(r.to.slice(0, 4)), nowYear);
  const out: DayRange[] = [];
  for (let y = y0; y <= y1; y++) {
    const a = `${y}-01-01`;
    const b = `${y}-12-31`;
    out.push({ from: r.from > a ? r.from : a, to: r.to < b ? r.to : b });
  }
  return out;
}

/** বছরের টুকরোগুলো সমান্তরালে আনে; একই id একবারই। কোনো টুকরো ব্যর্থ হলে পুরোটা throw — আংশিক ফল কখনো নয় */
export async function fetchRange<T extends { id: string }>(list: (r: DayRange) => Promise<T[]>, r: DayRange, nowYear: number): Promise<T[]> {
  const parts = await Promise.all(splitByYear(r, nowYear).map((c) => list(c)));
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of parts.flat()) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

type PostLike = {
  id: string;
  title: string;
  body: string;
  status: string;
  visibility: string;
  contentType?: string;
  date?: string;
  location?: string;
  createdAt: Date;
};

/** শুধু দিনলিপি (trashed বাদ); `onlyPublic` হলে শুধু প্রকাশিত+public; দিন ও তৈরির সময়-ক্রমে */
export function selectEntries<T extends PostLike>(posts: readonly T[], onlyPublic: boolean): T[] {
  return posts
    .filter((p) => p.contentType === "diary" && p.status !== "trashed" && (!onlyPublic || diaryVisOf(p) === "public"))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.createdAt.getTime() - b.createdAt.getTime());
}

export type DownloadEntry = { id: string; day: string; title: string; location?: string; period?: string; night?: boolean; lines: string[] };

/** লেখা → দিন, (নিজে-দেওয়া) শিরোনাম, স্থান, বেলা (লেখার সময় থেকে; `tz` দিলে), লাইন। স্বয়ংক্রিয় শিরোনাম (তারিখ) বাদ। বডি শুধু টেক্সট — ছবি/ফরম্যাট বাদ */
export function toEntries(posts: readonly PostLike[], tz?: string): DownloadEntry[] {
  return posts.map((p) => {
    const day = p.date ?? "";
    const auto = day && isValidDayKey(day) ? formatDate(new Date(`${day}T12:00:00Z`), "UTC") : "";
    const t = p.title.trim();
    const text = docToText(parseBody(p.body)).replace(/\r\n?/g, "\n");
    const per = tz ? periodOf(p.createdAt, tz) : null;
    return {
      id: p.id,
      day,
      title: t !== "" && t !== auto ? t : "",
      ...(p.location ? { location: p.location } : {}),
      ...(per ? { period: bn.diary.periods[per], night: per === "night" } : {}),
      lines: text === "" ? [] : text.split("\n"),
    };
  });
}

/** দিন-key → বাংলা অংশ (দিন-সংখ্যা, মাস-বছর, বার, সম্পূর্ণ); অবৈধ হলে null */
export function dayParts(day: string): { num: string; monthYear: string; weekday: string; long: string } | null {
  if (!isValidDayKey(day)) return null;
  const d = new Date(`${day}T12:00:00Z`);
  const monthYear = `${bn.diary.months[d.getUTCMonth()]} ${bnNum(d.getUTCFullYear())}`;
  const num = bnNum(d.getUTCDate());
  return { num, monthYear, weekday: bn.public.weekdaysFull[d.getUTCDay()]!, long: `${num} ${monthYear}` };
}

const CHARS_PER_LINE = 34;
const LINES_PER_PAGE = 22;
/** মলাটসহ আনুমানিক পাতা (হিসাব মোটামুটি; আসল সংখ্যা থিম/ফন্টভেদে একটু বদলায়) */
export function estimatePages(entries: readonly DownloadEntry[]): number {
  let pages = 1; // মলাট
  for (const e of entries) {
    const body = e.lines.reduce((n, l) => n + Math.max(1, Math.ceil(l.length / CHARS_PER_LINE)), 0);
    pages += Math.max(1, Math.ceil((body + 4) / LINES_PER_PAGE));
  }
  return pages;
}
