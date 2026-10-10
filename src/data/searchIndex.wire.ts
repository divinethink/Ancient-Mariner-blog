// ব্রাউজারে খোঁজ-index-এর জোগান (lazy; শুধু dashboard)। সংরক্ষণ = localStore (IndexedDB, logout-এ clearAll-এ মোছে)।
import { getOwnerDb } from "@/data/ownerDb";
import { localStore } from "@/data/localStore";
import {
  syncIndex,
  verifyEntry,
  type IndexMeta,
  type IndexStore,
  type SearchSource,
} from "@/data/searchIndex";
import type { SearchEntry } from "@/lib/search";

const META = "search:meta";
const E = "search:e:";

export const indexStore: IndexStore = {
  getMeta: () => localStore.get<IndexMeta>(META),
  setMeta: (m) => localStore.set(META, m),
  all: async () => (await localStore.entries<SearchEntry>(E)).map(([, v]) => v),
  write: (puts, dels) =>
    localStore.writeMany(
      puts.map((p) => [`${E}${p.key}`, p]),
      dels.map((k) => `${E}${k}`),
    ),
};

let src: Promise<SearchSource> | undefined;
const source = (): Promise<SearchSource> =>
  (src ??= (async () => {
    const [{ db }, { createSearchSource }] = await Promise.all([
      getOwnerDb(),
      import("@/data/searchSource.client"),
    ]);
    return createSearchSource(db);
  })().catch((e) => {
    src = undefined; // পরের চেষ্টায় আবার
    throw e;
  }));

/** লোকাল index (নেট ছাড়াই) — entries + শেষ sync-সময় (ms; কখনো না হলে 0) */
export async function loadLocalIndex(): Promise<{ entries: SearchEntry[]; syncedAt: number }> {
  const [entries, meta] = await Promise.all([indexStore.all(), indexStore.getMeta()]);
  return { entries, syncedAt: meta?.syncedAt ?? 0 };
}

/** full=true ⇒ পূর্ণ sync + আর-নেই-এমন entry মোছা (Settings-এর 'খোঁজ-index নতুন করে বানান') */
export async function syncSearchIndex(opts: { full?: boolean } = {}) {
  return syncIndex(await source(), indexStore, opts);
}

/** ফল খোলার আগে অস্তিত্ব-যাচাই: true/false/null(অজানা) */
export async function verifySearchEntry(entry: Pick<SearchEntry, "kind" | "id">) {
  try {
    return await verifyEntry(await source(), indexStore, entry);
  } catch {
    return null;
  }
}
