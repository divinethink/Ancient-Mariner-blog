// পূর্ণ-লেখা খোঁজ-index (P8b): owner-এর posts/ideas/notes-এর শিরোনাম+সারাংশ+সাধারণ-লেখা ডিভাইসের IndexedDB-তে।
// SDK-মুক্ত — Firestore পড়া `SearchSource`-এর (searchSource.client.ts) পেছনে; সংরক্ষণ `IndexStore`-এর পেছনে (localStore)।
// প্রথমবার পূর্ণ sync; পরে শুধু `updatedAt` বদলানো doc (single-field query, নতুন index নেই)।
// স্থায়ীভাবে মোছা লেখা delta-তে ধরা পড়ে না: পূর্ণ sync (rebuild) reconcile করে, আর ফল খোলার সময় `verify` অস্তিত্ব দেখে।
import {
  entryKey,
  isIndexablePost,
  maxUpdated,
  SEARCH_INDEX_VERSION,
  syncCursor,
  type SearchEntry,
  type SearchKind,
} from "@/lib/search";

export const KINDS: readonly SearchKind[] = ["post", "idea", "note", "chapter"];

export type IndexMeta = {
  v: number;
  /** প্রতি ধরনে শেষ-দেখা `updatedAt` (ms) */
  cursors: Partial<Record<SearchKind, number>>;
  /** শেষ সফল sync (ms) */
  syncedAt: number;
};

export interface SearchSource {
  /** since=null ⇒ সব doc; নইলে `updatedAt >= since`। ট্র্যাশের লেখাও আসে (status='trashed') যাতে index থেকে সরানো যায়। */
  fetch(kind: SearchKind, since: number | null): Promise<SearchEntry[]>;
  /** true/false = আছে/নেই; ব্যর্থ হলে throw */
  exists(kind: SearchKind, id: string): Promise<boolean>;
}

export interface IndexStore {
  getMeta(): Promise<IndexMeta | undefined>;
  setMeta(m: IndexMeta): Promise<void>;
  all(): Promise<SearchEntry[]>;
  write(puts: SearchEntry[], deleteKeys: string[]): Promise<void>;
}

export type SyncResult = { full: boolean; changed: number; removed: number; total: number };

/** একটা sync একসাথে একটাই চলে (পেজ-খোলা + ম্যানুয়াল rebuild-এর ধাক্কা এড়াতে) */
let running: Promise<SyncResult> | undefined;

export function syncIndex(
  source: SearchSource,
  store: IndexStore,
  opts: { full?: boolean; now?: () => number } = {},
): Promise<SyncResult> {
  running ??= run(source, store, opts).finally(() => {
    running = undefined;
  });
  return running;
}

async function run(
  source: SearchSource,
  store: IndexStore,
  opts: { full?: boolean; now?: () => number },
): Promise<SyncResult> {
  const now = opts.now ?? Date.now;
  let meta = await store.getMeta();
  let existing = await store.all();
  let stale = false;
  if (meta && meta.v !== SEARCH_INDEX_VERSION) {
    stale = true; // রূপ বদলেছে: পুরনো entry বাদ দিয়ে নতুন করে (নইলে ভুল-রূপ থেকে যেত)
    meta = undefined;
  }
  const forceFull = opts.full === true || !meta;
  const cursors: IndexMeta["cursors"] = { ...(meta?.cursors ?? {}) };
  let changed = 0;
  let removed = 0;
  if (stale) {
    await store.write(
      [],
      existing.map((e) => e.key),
    );
    removed += existing.length;
    existing = [];
  }
  for (const kind of KINDS) {
    const since = forceFull ? null : syncCursor(cursors[kind]);
    const items = await source.fetch(kind, since);
    const puts: SearchEntry[] = [];
    const dels = new Set<string>();
    for (const it of items) {
      if ((it.kind === "post" || it.kind === "chapter") && !isIndexablePost(it.status ?? "")) dels.add(it.key);
      else puts.push(it);
    }
    if (since === null) {
      // পূর্ণ sync: সার্ভারে আর নেই এমন entry মোছা (স্থায়ীভাবে মোছা লেখা)
      const live = new Set(puts.map((p) => p.key));
      for (const e of existing) if (e.kind === kind && !live.has(e.key)) dels.add(e.key);
    }
    const had = new Set(existing.filter((e) => e.kind === kind).map((e) => e.key));
    const realDels = [...dels].filter((k) => had.has(k));
    await store.write(puts, realDels);
    changed += puts.length;
    removed += realDels.length;
    cursors[kind] = maxUpdated(items, since === null ? 0 : (cursors[kind] ?? 0));
    // এই ধরনের কাজ সম্পূর্ণ — cursor এগোনো (পরের ধরনে ব্যর্থ হলেও এটা হারায় না)
    await store.setMeta({ v: SEARCH_INDEX_VERSION, cursors, syncedAt: meta?.syncedAt ?? 0 });
    existing = existing
      .filter((e) => e.kind !== kind)
      .concat(puts.filter((p) => !realDels.includes(p.key)));
  }
  await store.setMeta({ v: SEARCH_INDEX_VERSION, cursors, syncedAt: now() });
  return { full: forceFull, changed, removed, total: (await store.all()).length };
}

/** ফল খোলার আগে: doc এখনো আছে? নেই ⇒ index থেকে মুছে false; নেট-সমস্যায় null (অজানা — খুলতে দেওয়া) */
export async function verifyEntry(
  source: SearchSource,
  store: IndexStore,
  entry: Pick<SearchEntry, "kind" | "id">,
): Promise<boolean | null> {
  try {
    if (await source.exists(entry.kind, entry.id)) return true;
  } catch {
    return null;
  }
  await store.write([], [entryKey(entry.kind, entry.id)]).catch(() => undefined);
  return false;
}
