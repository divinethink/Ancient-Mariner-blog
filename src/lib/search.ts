// পূর্ণ-লেখা খোঁজ (P8b) — pure, SDK/UI-মুক্ত। নতুন dependency নেই।
// বাংলা: NFC normalize + অদৃশ্য ZWJ/ZWNJ/soft-hyphen বাদ (টাইপের ধরনে বদলায়) + lower-case, তারপর সব শব্দ (AND) মেলানো।
// ফল-হাইলাইট মূল (NFC) লেখার অবস্থানে ফেরত যায়, তাই যুক্তাক্ষর ভাঙে না।
import { parseBody, type DocNode } from "./editorDoc";
import { serializeDoc } from "./export/serialize";
import { fold, foldOnly, tokenize, MAX_TOKENS } from "./fold";

export { fold, tokenize, MAX_TOKENS };

export const SEARCH_INDEX_VERSION = 1;
export const SEARCH_LIMIT = 50;
/** একটা লেখার index-টেক্সট সীমা (অক্ষর) — ~৯০০KB body-র সাধারণ লেখা এর ভেতরে */
export const MAX_ENTRY_TEXT = 400_000;
/** delta-sync-এ শেষ-দেখা `updatedAt`-এর আগে এত ms পিছিয়ে পড়া (clock/commit-ক্রম নিরাপত্তা; upsert idempotent) */
export const SYNC_OVERLAP_MS = 5 * 60 * 1000;

export type SearchKind = "post" | "idea" | "note" | "chapter";

export type SearchEntry = {
  /** `${kind}:${id}` */
  key: string;
  kind: SearchKind;
  id: string;
  title: string;
  excerpt: string;
  /** সাধারণ-লেখা (NFC) */
  text: string;
  /** শুধু post */
  contentType?: string;
  status?: string;
  categoryId?: string;
  categoryName?: string;
  /** শুধু chapter (P14c-২): খোলার পথ বানাতে */
  projectId?: string;
  /** epoch ms */
  updatedAt: number;
};

export const entryKey = (kind: SearchKind, id: string) => `${kind}:${id}`;

// ── entry বানানো ──────────────────────────────────────────────────────────

const cap = (s: string) => (s.length > MAX_ENTRY_TEXT ? s.slice(0, MAX_ENTRY_TEXT) : s);
const nfc = (s: string) => s.normalize("NFC");
const ms = (d: Date | number | undefined) => (d instanceof Date ? d.getTime() : (d ?? 0));

export function postEntry(p: {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  contentType?: string;
  status: string;
  categoryId?: string;
  categoryName?: string;
  updatedAt: Date | number;
}): SearchEntry {
  const doc: DocNode = parseBody(p.body);
  return {
    key: entryKey("post", p.id),
    kind: "post",
    id: p.id,
    title: nfc(p.title),
    excerpt: nfc(p.excerpt),
    text: cap(nfc(serializeDoc(doc, "plain"))),
    contentType: p.contentType,
    status: p.status,
    categoryId: p.categoryId,
    categoryName: p.categoryName,
    updatedAt: ms(p.updatedAt),
  };
}

export function ideaEntry(i: {
  id: string;
  title?: string;
  text: string;
  type?: string;
  updatedAt: Date | number;
}): SearchEntry {
  return {
    key: entryKey("idea", i.id),
    kind: "idea",
    id: i.id,
    title: nfc(i.title ?? ""),
    excerpt: "",
    text: cap(nfc(i.text)),
    contentType: i.type,
    updatedAt: ms(i.updatedAt),
  };
}

export function noteEntry(n: {
  id: string;
  title?: string;
  content: string;
  kind?: string;
  updatedAt: Date | number;
}): SearchEntry {
  return {
    key: entryKey("note", n.id),
    kind: "note",
    id: n.id,
    title: nfc(n.title ?? ""),
    excerpt: "",
    text: cap(nfc(n.content)),
    contentType: n.kind,
    updatedAt: ms(n.updatedAt),
  };
}

/** অধ্যায় (P14c-২): ব্যক্তিগত পূর্ণ-লেখা খোঁজে; `excerpt` = প্রজেক্টের নাম (প্রজেক্ট-নামেও খোঁজা যায়); `status` ট্র্যাশ হলে index থেকে বাদ */
export function chapterEntry(c: {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  body: string;
  status: string;
  updatedAt: Date | number;
}): SearchEntry {
  return {
    key: entryKey("chapter", c.id),
    kind: "chapter",
    id: c.id,
    title: nfc(c.title),
    excerpt: nfc(c.projectTitle),
    text: cap(nfc(serializeDoc(parseBody(c.body), "plain"))),
    status: c.status,
    projectId: c.projectId,
    updatedAt: ms(c.updatedAt),
  };
}

/** ট্র্যাশের লেখা index-এ থাকে না (Arch §১৭ P8b) */
export const isIndexablePost = (status: string): boolean => status !== "trashed";

/** delta-sync cursor: প্রথমবার (বা আগের মান নেই) = null ⇒ পূর্ণ sync; নইলে শেষ-দেখা `updatedAt` − overlap */
export function syncCursor(lastSeen: number | undefined): number | null {
  if (!lastSeen || lastSeen <= 0) return null;
  return Math.max(0, lastSeen - SYNC_OVERLAP_MS);
}

export const maxUpdated = (xs: readonly { updatedAt: number }[], prev = 0): number =>
  xs.reduce((m, x) => (x.updatedAt > m ? x.updatedAt : m), prev);

// ── খোঁজ ──────────────────────────────────────────────────────────────────

export type Prepared = { entry: SearchEntry; t: string; e: string; x: string };

/** লোডের সময় একবার folded রূপ বানানো — প্রতি কী-স্ট্রোকে নয় */
export const prepare = (entries: readonly SearchEntry[]): Prepared[] =>
  entries.map((entry) => ({
    entry,
    t: foldOnly(entry.title),
    e: foldOnly(entry.excerpt),
    x: foldOnly(entry.text),
  }));

export type SearchFilter = {
  /** "idea" | "note" | contentType-মান (শুধু লেখা); খালি = সব */
  type?: string;
  categoryId?: string;
  /** শুধু লেখা (post) — idea/note বাদ পড়ে */
  status?: string;
};

export function passesFilter(e: SearchEntry, f: SearchFilter): boolean {
  if (f.type) {
    if (f.type === "idea" || f.type === "note" || f.type === "chapter") {
      if (e.kind !== f.type) return false;
    } else if (e.kind !== "post" || e.contentType !== f.type) return false;
  }
  if (f.categoryId && !(e.kind === "post" && e.categoryId === f.categoryId)) return false;
  if (f.status && !(e.kind === "post" && e.status === f.status)) return false;
  return true;
}

export type SearchHit = { entry: SearchEntry; score: number };

/** সব শব্দ (AND) শিরোনাম/সারাংশ/লেখার যেকোনোটায় থাকতে হবে। স্কোর: শিরোনাম > সারাংশ > লেখা; নতুন আগে। */
export function search(
  prepared: readonly Prepared[],
  query: string,
  filter: SearchFilter = {},
  limit = SEARCH_LIMIT,
): { hits: SearchHit[]; total: number } {
  const tokens = tokenize(query);
  if (tokens.length === 0) return { hits: [], total: 0 };
  const phrase = tokens.length > 1 ? tokens.join(" ") : "";
  const hits: SearchHit[] = [];
  for (const p of prepared) {
    if (!passesFilter(p.entry, filter)) continue;
    let score = 0;
    let ok = true;
    for (const tk of tokens) {
      const inT = p.t.includes(tk);
      const inE = p.e.includes(tk);
      const inX = p.x.includes(tk);
      if (!inT && !inE && !inX) {
        ok = false;
        break;
      }
      score += (inT ? 10 : 0) + (inE ? 4 : 0) + (inX ? 1 : 0) + (p.t.startsWith(tk) ? 5 : 0);
    }
    if (!ok) continue;
    if (phrase && (p.t.includes(phrase) || p.x.includes(phrase))) score += 3;
    hits.push({ entry: p.entry, score });
  }
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      b.entry.updatedAt - a.entry.updatedAt ||
      (a.entry.key < b.entry.key ? -1 : 1),
  );
  return { hits: hits.slice(0, Math.max(0, limit)), total: hits.length };
}

/** শব্দ ছাড়া শুধু ফিল্টার (ক্যাটাগরি/অবস্থা) মিলিয়ে তালিকা — নতুন আগে। ফিল্টার একটাও না থাকলে খালি */
export function listByFilter(
  prepared: readonly Prepared[],
  filter: SearchFilter,
  limit = SEARCH_LIMIT,
): { hits: SearchHit[]; total: number } {
  if (!filter.type && !filter.categoryId && !filter.status) return { hits: [], total: 0 };
  const hits: SearchHit[] = prepared
    .filter((p) => passesFilter(p.entry, filter))
    .map((p) => ({ entry: p.entry, score: 0 }));
  hits.sort(
    (x, y) => y.entry.updatedAt - x.entry.updatedAt || (x.entry.key < y.entry.key ? -1 : 1),
  );
  return { hits: hits.slice(0, Math.max(0, limit)), total: hits.length };
}

// ── হাইলাইট ───────────────────────────────────────────────────────────────

export type Seg = { text: string; hit: boolean };

/** মূল (NFC) লেখায় সব শব্দের মিলের [শুরু, শেষ) — মিলিয়ে নেওয়া, ক্রমানুসারে */
export function matchRanges(src: string, tokens: readonly string[]): [number, number][] {
  const { f, map, nfc: s } = fold(src);
  const raw: [number, number][] = [];
  for (const tk of tokens) {
    if (!tk) continue;
    for (let from = 0; ;) {
      const at = f.indexOf(tk, from);
      if (at < 0) break;
      const end = at + tk.length;
      raw.push([map[at], end < map.length ? map[end] : s.length]);
      from = end;
    }
  }
  raw.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: [number, number][] = [];
  for (const r of raw) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

export function toSegments(s: string, ranges: readonly [number, number][]): Seg[] {
  const out: Seg[] = [];
  let at = 0;
  for (const [a, b] of ranges) {
    if (a > at) out.push({ text: s.slice(at, a), hit: false });
    if (b > a) out.push({ text: s.slice(a, b), hit: true });
    at = Math.max(at, b);
  }
  if (at < s.length) out.push({ text: s.slice(at), hit: false });
  return out;
}

export const SNIPPET_BEFORE = 40;
export const SNIPPET_LEN = 150;

/** surrogate pair মাঝখানে না কেটে সীমা সরানো */
const safeCut = (s: string, i: number): number => {
  if (i <= 0 || i >= s.length) return Math.min(Math.max(i, 0), s.length);
  const c = s.charCodeAt(i);
  return c >= 0xdc00 && c <= 0xdfff ? i - 1 : i;
};

export type Highlighted = {
  title: Seg[];
  snippet: Seg[];
  snippetFrom: "text" | "excerpt" | "none";
};

/** কার্ডের জন্য: শিরোনাম-হাইলাইট + প্রথম মিলের চারপাশের ছোট অংশ (লেখা, নইলে সারাংশ) */
export function highlight(entry: SearchEntry, query: string): Highlighted {
  const tokens = tokenize(query);
  const title = toSegments(entry.title, matchRanges(entry.title, tokens));
  const pick = (src: string, label: "text" | "excerpt") => {
    const r = matchRanges(src, tokens);
    return r.length ? { src, r, label } : null;
  };
  const found = pick(entry.text, "text") ?? pick(entry.excerpt, "excerpt");
  if (!found) {
    const lead = entry.excerpt || entry.text;
    const cut = lead.length > SNIPPET_LEN ? `${lead.slice(0, safeCut(lead, SNIPPET_LEN))}…` : lead;
    return { title, snippet: cut ? [{ text: cut, hit: false }] : [], snippetFrom: "none" };
  }
  const { src, r, label } = found;
  let from = safeCut(src, Math.max(0, r[0][0] - SNIPPET_BEFORE));
  if (from > 0) {
    // শব্দের মাঝখানে না শুরু: কাছের আগের ফাঁকায় সরে আসা
    const sp = src.slice(Math.max(0, from - 15), from).search(/\s\S*$/u);
    if (sp >= 0) from = Math.max(0, from - 15) + sp + 1;
  }
  const to = safeCut(src, Math.min(src.length, from + SNIPPET_LEN));
  const win = src.slice(from, to);
  const local: [number, number][] = [];
  for (const [a, b] of r) {
    if (b <= from || a >= to) continue;
    local.push([Math.max(a, from) - from, Math.min(b, to) - from]);
  }
  const segs = toSegments(win, local);
  if (from > 0) segs.unshift({ text: "…", hit: false });
  if (to < src.length) segs.push({ text: "…", hit: false });
  return { title, snippet: segs, snippetFrom: label };
}

// ── ফিল্টারের বিকল্প ──────────────────────────────────────────────────────

export type Facets = { types: string[]; categories: { id: string; name: string }[] };

/** index-এ আসলে যা আছে সেটাই বিকল্প (ফাঁকা বিকল্প নয়); contentType-গুলো পাওয়ার ক্রম অনুযায়ী নির্দিষ্ট */
export function facets(entries: readonly SearchEntry[], typeOrder: readonly string[]): Facets {
  const ts = new Set<string>();
  const cats = new Map<string, string>();
  for (const e of entries) {
    if (e.kind === "post" && e.contentType) ts.add(e.contentType);
    if (e.kind === "post" && e.categoryId) cats.set(e.categoryId, e.categoryName || e.categoryId);
  }
  return {
    types: typeOrder.filter((t) => ts.has(t)),
    categories: [...cats]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "bn")),
  };
}
