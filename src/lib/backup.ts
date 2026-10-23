// JSON ব্যাকআপ এক্সপোর্টের pure যুক্তি (SDK/UI-মুক্ত; P2c-৩)। শুধু read — কিছু লেখে/মোছে না।
// Timestamp = {"$timestamp":"ISO"} (P5b-র restore এই চিহ্ন পড়বে)। revisions বাদ। ফাইল: format/version/exportedAt → collections → counts।
export const BACKUP_FORMAT = "ancient-mariner-backup";
export const BACKUP_VERSION = 1;
export const BACKUP_COLLECTIONS = ["posts", "drafts", "slugs", "siteSettings", "ideas", "notes", "categories", "tags", "series", "pages", "media", "templates", "bookmarks", "highlights", "writingProjects", "chapters", "letters", "books", "quotes"] as const;
export type BackupCollection = (typeof BACKUP_COLLECTIONS)[number];

export const BACKUP_PAGE_SIZE = 100;
/** Spark plan-এর দৈনিক read সীমা (সচেতনতা-দেখানোর জন্য) */
export const DAILY_READ_LIMIT = 50000;

export type BackupDoc = { id: string; data: Record<string, unknown> };

/** UI/SDK-মুক্ত উৎস: SDK adapter (`data/backupRepo.client.ts`) এটি পূরণ করে */
export interface BackupSource {
  count(col: BackupCollection): Promise<number>;
  /** `afterId`-এর পরের পাতা, doc-id ক্রমে; শেষ হলে খালি */
  readPage(col: BackupCollection, afterId: string | undefined, size: number): Promise<BackupDoc[]>;
}

const isTs = (v: unknown): v is { toDate: () => Date } =>
  typeof v === "object" && v !== null && typeof (v as { toDate?: unknown }).toDate === "function";

/** Firestore মান → JSON-নিরাপদ: Timestamp/Date → {"$timestamp"}; undefined বাদ */
export function encodeValue(v: unknown): unknown {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : { $timestamp: v.toISOString() };
  if (isTs(v)) return encodeValue(v.toDate());
  if (Array.isArray(v)) return v.map((x) => (x === undefined ? null : encodeValue(x)));
  if (v !== null && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => x !== undefined)
        .map(([k, x]) => [k, encodeValue(x)]),
    );
  }
  return v;
}

export const totalDocs = (counts: Partial<Record<BackupCollection, number>>): number =>
  Object.values(counts).reduce<number>((s, n) => s + (n ?? 0), 0);

/** মোট read-এর দৈনিক সীমার কত শতাংশ (এক দশমিক) */
export const readPercent = (reads: number): number => Math.round((reads / DAILY_READ_LIMIT) * 1000) / 10;

export function backupFileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `ancient-mariner-backup-${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}.json`;
}

export type BackupResult = { counts: Record<BackupCollection, number>; total: number };

/**
 * পাতায় পাতায় পড়ে JSON টুকরো `sink`-এ দেয় (caller Blob-parts-এ জমায়) — পুরো ডেটা একসাথে মেমরিতে নয়।
 * `signal` abort হলে throw; তখন আংশিক ফাইল বাতিল করা caller-এর দায়িত্ব। প্রতিটি doc ঠিক একবার (id-ক্রম, cursor)।
 */
export async function exportBackup(
  source: BackupSource,
  opts: {
    sink: (chunk: string) => void;
    now?: Date;
    pageSize?: number;
    signal?: AbortSignal;
    onProgress?: (col: BackupCollection, readSoFar: number) => void;
  },
): Promise<BackupResult> {
  const size = opts.pageSize ?? BACKUP_PAGE_SIZE;
  const counts = {} as Record<BackupCollection, number>;
  opts.sink(
    `{"format":${JSON.stringify(BACKUP_FORMAT)},"version":${BACKUP_VERSION},"exportedAt":${JSON.stringify((opts.now ?? new Date()).toISOString())},"collections":{`,
  );
  let readAll = 0;
  for (const [ci, col] of BACKUP_COLLECTIONS.entries()) {
    opts.sink(`${ci ? "," : ""}${JSON.stringify(col)}:[`);
    let after: string | undefined;
    let n = 0;
    for (;;) {
      if (opts.signal?.aborted) throw new Error("ব্যাকআপ বাতিল");
      const page = await source.readPage(col, after, size);
      if (page.length === 0) break;
      opts.sink(
        page.map((d) => `${n++ ? "," : ""}${JSON.stringify({ id: d.id, data: encodeValue(d.data) })}`).join(""),
      );
      readAll += page.length;
      after = page[page.length - 1].id;
      opts.onProgress?.(col, readAll);
      if (page.length < size) break;
    }
    counts[col] = n;
    opts.sink("]");
  }
  opts.sink(`},"counts":${JSON.stringify(counts)}}`);
  return { counts, total: totalDocs(counts) };
}
