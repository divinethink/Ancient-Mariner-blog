// Drive auto-backup-এর নীতি (pure, SDK/UI-মুক্ত; P5b-১)। retention/stale/ফাইল-ভাগ: Arch §১৫। কিছু লেখে/মোছে না — শুধু সিদ্ধান্ত দেয়।
// সময় সবসময় UTC (folder-নাম ও 'দিন'); ব্যবহারকারীকে দেখানোর সময় lib/datetime দিয়ে সাইট-timezone-এ।
export const BACKUP_FOLDER_PREFIX = "ancient-mariner-backup-";
export const BACKUP_KEEP_DAILY = 7; // শেষ ৭ দিন (প্রতিদিনের সর্বশেষটা)
export const BACKUP_KEEP_WEEKLY = 4; // শেষ ৪টা রবিবারের (UTC)
export const BACKUP_KEEP_MANUAL = 3; // হাতে-নেওয়া (যেমন ইমপোর্টের আগে) সর্বশেষ ৩টা — একই দিনের auto-তে মুছে যায় না
export const BACKUP_STALE_DAYS = 3; // এর বেশি পুরনো হলে লাল সতর্কতা (Arch §১৫)
export const BACKUP_INCOMPLETE_GRACE_MS = 24 * 60 * 60 * 1000; // অসম্পূর্ণ ফোল্ডার এর আগে মোছা নয়
export const BACKUP_PART_MAX_BYTES = 10 * 1024 * 1024; // এক ফাইলের সর্বোচ্চ আকার (UTF-8 byte)

const DAY_MS = 24 * 60 * 60 * 1000;
const p2 = (n: number) => String(n).padStart(2, "0");

/** `ancient-mariner-backup-YYYYMMDD-HHmm` (UTC; একই দিনে একাধিক backup-এ সংঘাত নেই) */
export const backupFolderName = (now: Date): string =>
  `${BACKUP_FOLDER_PREFIX}${now.getUTCFullYear()}${p2(now.getUTCMonth() + 1)}${p2(now.getUTCDate())}-${p2(now.getUTCHours())}${p2(now.getUTCMinutes())}`;

/** অ্যাপের নিজের নামের ফোল্ডার হলে তার সময়, নইলে null (বাইরের ফোল্ডার কখনো মোছা হয় না) */
export function parseBackupFolderName(name: string): Date | null {
  const m = /^ancient-mariner-backup-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(name);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const ok =
    dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d && dt.getUTCHours() === h && dt.getUTCMinutes() === mi;
  return ok ? dt : null;
}

export type DriveFolder = {
  id: string;
  name: string;
  /** `backups` doc-এ এই folder-id আছে কিনা (= যাচাই-সম্পূর্ণ) */
  complete: boolean;
  /** complete হলে `backups` doc-এর type; অজানা হলে auto ধরা হয় */
  type?: "auto" | "manual";
};

/**
 * কোন ফোল্ডার থাকবে/মুছবে। caller নতুন backup যাচাই-সম্পূর্ণ হওয়ার পরেই এটা চালায়।
 * - অ্যাপের নামের বাইরের ফোল্ডার: কোনো তালিকাতেই নেই (অক্ষত)।
 * - সম্পূর্ণ ফোল্ডার না থাকলে কিছুই মোছা হয় না।
 * - থাকে: প্রতিদিনের সর্বশেষ × ৭ দিন, রবিবারের সর্বশেষ × ৪, manual × ৩; বাকি সম্পূর্ণগুলো মোছা।
 * - অসম্পূর্ণ: ২৪ ঘণ্টার বেশি পুরনো হলে মোছা (ব্যর্থ রানের জঞ্জাল), নইলে থাকে।
 */
export function planRetention(folders: readonly DriveFolder[], now: Date): { keep: DriveFolder[]; remove: DriveFolder[] } {
  const parsed = folders
    .map((f) => ({ f, t: parseBackupFolderName(f.name) }))
    .filter((x): x is { f: DriveFolder; t: Date } => x.t !== null)
    .sort((a, b) => b.t.getTime() - a.t.getTime());
  const complete = parsed.filter((x) => x.f.complete);
  if (complete.length === 0) return { keep: parsed.map((x) => x.f), remove: [] };

  const dayKey = (d: Date) => `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}`;
  const seen = new Set<string>();
  const perDay = complete.filter((x) => {
    const k = dayKey(x.t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const keepIds = new Set<string>([
    ...perDay.slice(0, BACKUP_KEEP_DAILY).map((x) => x.f.id),
    ...perDay.filter((x) => x.t.getUTCDay() === 0).slice(0, BACKUP_KEEP_WEEKLY).map((x) => x.f.id),
    ...complete.filter((x) => x.f.type === "manual").slice(0, BACKUP_KEEP_MANUAL).map((x) => x.f.id),
  ]);

  const keep: DriveFolder[] = [];
  const remove: DriveFolder[] = [];
  for (const { f, t } of parsed) {
    const drop = f.complete ? !keepIds.has(f.id) : now.getTime() - t.getTime() >= BACKUP_INCOMPLETE_GRACE_MS;
    (drop ? remove : keep).push(f);
  }
  return { keep, remove };
}

/** শ্রিঙ্ক-গার্ড: এই collection-গুলোর doc হঠাৎ কমলে স্বয়ংক্রিয় backup থামে (drafts বাদ — স্বাভাবিকভাবেই ওঠানামা করে) */
export const SHRINK_GUARD_COLLECTIONS = ["posts", "chapters", "pages"] as const;
export const SHRINK_MIN_PREV = 10; // আগে এর কম থাকলে গার্ড নিষ্ক্রিয় (ছোট সংখ্যায় শতাংশ অর্থহীন)
export const SHRINK_MAX_DROP = 0.2; // ২০%-এর বেশি কমলে সন্দেহজনক

export type Shrink = { col: string; prev: number; next: number };

/** আগের সম্পূর্ণ backup-এর counts-এর তুলনায় সন্দেহজনক হ্রাসের তালিকা (খালি = ঠিক আছে) */
export function findShrink(prev: Readonly<Record<string, number>> | undefined, next: Readonly<Record<string, number>>): Shrink[] {
  if (!prev) return [];
  const out: Shrink[] = [];
  for (const col of SHRINK_GUARD_COLLECTIONS) {
    const p = prev[col];
    const n = next[col] ?? 0;
    if (typeof p === "number" && p >= SHRINK_MIN_PREV && n < p * (1 - SHRINK_MAX_DROP)) out.push({ col, prev: p, next: n });
  }
  return out;
}

/** সর্বশেষ সফল backup ৩ দিনের বেশি পুরনো (বা একটাও নেই) হলে true; ঘড়ি পিছিয়ে থাকলে false */
export const isBackupStale = (lastCompletedAt: Date | undefined, now: Date): boolean =>
  lastCompletedAt === undefined || now.getTime() - lastCompletedAt.getTime() > BACKUP_STALE_DAYS * DAY_MS;

/** doc-গুলো ক্রমে জমিয়ে `maxBytes` ছাড়ানোর আগেই নতুন ভাগ; একটা doc নিজেই বড় হলে একা এক ভাগ; খালি হলেও ১টা (খালি) ভাগ */
export function splitIntoParts<T>(items: readonly T[], sizeOf: (t: T) => number, maxBytes: number = BACKUP_PART_MAX_BYTES): T[][] {
  const parts: T[][] = [[]];
  let used = 0;
  for (const it of items) {
    const sz = sizeOf(it);
    const cur = parts[parts.length - 1];
    if (cur.length > 0 && used + sz > maxBytes) {
      parts.push([it]);
      used = sz;
    } else {
      cur.push(it);
      used += sz;
    }
  }
  return parts;
}

/** `<collection>.json` (এক ভাগ) বা `<collection>-<N>.json` (N = ১-ভিত্তিক) */
export const backupPartName = (collection: string, part: number, parts: number): string =>
  parts <= 1 ? `${collection}.json` : `${collection}-${part}.json`;
