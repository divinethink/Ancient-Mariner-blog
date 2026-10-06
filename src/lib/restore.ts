// JSON-restore-এর pure যুক্তি (SDK/UI-মুক্ত; P5b-৩): ফাইল-parse, dry-run, চালানো। Firestore access `RestoreTarget`-এর মাধ্যমে (data/restoreRepo.client)।
// নীতি (owner-approved ২০২৬-১০-০৭): ডিফল্ট = শুধু অনুপস্থিত doc যোগ; বিদ্যমান overwrite আলাদা টগল। কোনো doc মোছা হয় না। doc-ID ধরে idempotent।
// দুই ধরনের ফাইল একই parser-এ: ম্যানুয়াল export (সব collection) ও Drive-এর প্রতি-collection ফাইল (`<col>.json` / `<col>-<N>.json`)।
import { BACKUP_COLLECTIONS, BACKUP_FORMAT, BACKUP_VERSION, type BackupCollection } from "./backup";

export const RESTORE_MAX_BYTES = 50 * 1024 * 1024;
export const RESTORE_CHUNK = 400; // Firestore batch সীমা ৫০০-এর নিচে
export const EXISTS_CHUNK = 30; // `documentId() in` সীমা
/** rules-এ `slugs` update নিষিদ্ধ (uniqueness-lock) — overwrite-মোডেও বিদ্যমান slug ছোঁয়া হয় না */
export const NEVER_OVERWRITE: ReadonlySet<string> = new Set(["slugs"]);

export type RestoreEntry = { id: string; data: Record<string, unknown> };
export type ParsedBackup = {
  collections: Record<BackupCollection, RestoreEntry[]>;
  /** তালিকার বাইরের collection (যেমন নতুন ভার্সনের) — বাদ */
  skippedCollections: string[];
  invalidDocs: number;
  duplicateDocs: number;
  files: number;
};
export type ParseError = {
  code: "not_json" | "wrong_format" | "newer_version" | "bad_shape" | "empty";
  file: number;
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function isValidDocId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    new TextEncoder().encode(id).length <= 1500 &&
    !id.includes("/") &&
    id !== "." &&
    id !== ".." &&
    !/^__.*__$/.test(id)
  );
}

export function parseBackupTexts(
  texts: readonly string[],
): { ok: true; value: ParsedBackup } | { ok: false; error: ParseError } {
  const cols = Object.fromEntries(
    BACKUP_COLLECTIONS.map((c) => [c, new Map<string, RestoreEntry>()]),
  ) as Record<BackupCollection, Map<string, RestoreEntry>>;
  const skipped = new Set<string>();
  let invalid = 0;
  let dup = 0;
  for (const [file, text] of texts.entries()) {
    let j: unknown;
    try {
      j = JSON.parse(text);
    } catch {
      return { ok: false, error: { code: "not_json", file } };
    }
    if (!isObj(j) || j.format !== BACKUP_FORMAT)
      return { ok: false, error: { code: "wrong_format", file } };
    if (typeof j.version !== "number" || j.version > BACKUP_VERSION)
      return { ok: false, error: { code: "newer_version", file } };
    if (!isObj(j.collections)) return { ok: false, error: { code: "bad_shape", file } };
    for (const [name, arr] of Object.entries(j.collections)) {
      if (!Array.isArray(arr)) return { ok: false, error: { code: "bad_shape", file } };
      if (!(BACKUP_COLLECTIONS as readonly string[]).includes(name)) {
        skipped.add(name);
        continue;
      }
      const m = cols[name as BackupCollection];
      for (const e of arr) {
        if (!isObj(e) || !isValidDocId(e.id) || !isObj(e.data)) {
          invalid++;
          continue;
        }
        if (m.has(e.id)) dup++;
        m.set(e.id, { id: e.id, data: e.data }); // একই id দুইবার = পরেরটা
      }
    }
  }
  const collections = Object.fromEntries(
    BACKUP_COLLECTIONS.map((c) => [c, [...cols[c].values()]]),
  ) as Record<BackupCollection, RestoreEntry[]>;
  if (BACKUP_COLLECTIONS.every((c) => collections[c].length === 0))
    return { ok: false, error: { code: "empty", file: 0 } };
  return {
    ok: true,
    value: {
      collections,
      skippedCollections: [...skipped],
      invalidDocs: invalid,
      duplicateDocs: dup,
      files: texts.length,
    },
  };
}

/** {"$timestamp": ISO} → `ts(iso)`; বাকি যেমন আছে। অবৈধ তারিখ = null (doc বাদ যায় না) */
export function decodeBackupValue(v: unknown, ts: (iso: string) => unknown): unknown {
  if (Array.isArray(v)) return v.map((x) => decodeBackupValue(x, ts));
  if (isObj(v)) {
    const keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === "$timestamp") {
      const iso = v.$timestamp;
      return typeof iso === "string" && !Number.isNaN(new Date(iso).getTime()) ? ts(iso) : null;
    }
    return Object.fromEntries(keys.map((k) => [k, decodeBackupValue(v[k], ts)]));
  }
  return v;
}

export interface RestoreTarget {
  /** এই collection-এ `ids`-এর কোনগুলো এখন আছে */
  existingIds(col: BackupCollection, ids: readonly string[]): Promise<Set<string>>;
  /** doc-ID ধরে set (caller কী লিখবে ঠিক করেছে); এক atomic batch */
  write(col: BackupCollection, entries: readonly RestoreEntry[]): Promise<void>;
}

export const chunkOf = <T>(a: readonly T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
};

export type DryRunRow = { total: number; add: number; existing: number };
export type DryRun = {
  rows: Record<BackupCollection, DryRunRow>;
  total: number;
  add: number;
  existing: number;
};

async function existingOf(
  t: RestoreTarget,
  col: BackupCollection,
  ids: readonly string[],
): Promise<Set<string>> {
  const s = new Set<string>();
  for (const part of chunkOf(ids, EXISTS_CHUNK))
    for (const id of await t.existingIds(col, part)) s.add(id);
  return s;
}

/** কিছু লেখে না — শুধু অস্তিত্ব পড়ে (প্রতি doc ১ read) */
export async function dryRun(p: ParsedBackup, t: RestoreTarget): Promise<DryRun> {
  const rows = {} as Record<BackupCollection, DryRunRow>;
  let total = 0;
  let add = 0;
  let existing = 0;
  for (const c of BACKUP_COLLECTIONS) {
    const entries = p.collections[c];
    const ex = entries.length
      ? await existingOf(
          t,
          c,
          entries.map((e) => e.id),
        )
      : new Set<string>();
    rows[c] = { total: entries.length, add: entries.length - ex.size, existing: ex.size };
    total += entries.length;
    add += rows[c].add;
    existing += ex.size;
  }
  return { rows, total, add, existing };
}

export type RestoreResult = {
  added: number;
  overwritten: number;
  skippedExisting: number;
  failedDocs: number;
  failedChunks: number;
};

/**
 * chunk-ভিত্তিক। প্রতি chunk লেখার ঠিক আগে অস্তিত্ব আবার দেখা (dry-run-পরবর্তী নতুন লেখা না মোছার জন্য)।
 * ব্যর্থ chunk গোনা হয়, বাকি চলে; আবার চালালে (idempotent) যা বাকি তা-ই লেখা হয়।
 */
export async function runRestore(
  p: ParsedBackup,
  t: RestoreTarget,
  opts: { overwrite: boolean; onProgress?: (done: number, total: number) => void },
): Promise<RestoreResult> {
  const r: RestoreResult = {
    added: 0,
    overwritten: 0,
    skippedExisting: 0,
    failedDocs: 0,
    failedChunks: 0,
  };
  const total = BACKUP_COLLECTIONS.reduce((s, c) => s + p.collections[c].length, 0);
  let done = 0;
  for (const c of BACKUP_COLLECTIONS) {
    for (const part of chunkOf(p.collections[c], RESTORE_CHUNK)) {
      try {
        const ex = await existingOf(
          t,
          c,
          part.map((e) => e.id),
        );
        const toWrite = part.filter(
          (e) => !ex.has(e.id) || (opts.overwrite && !NEVER_OVERWRITE.has(c)),
        );
        if (toWrite.length > 0) await t.write(c, toWrite);
        for (const e of toWrite) {
          if (ex.has(e.id)) r.overwritten++;
          else r.added++;
        }
        r.skippedExisting += part.length - toWrite.length;
      } catch {
        r.failedDocs += part.length;
        r.failedChunks++;
      }
      done += part.length;
      opts.onProgress?.(done, total);
    }
  }
  return r;
}
