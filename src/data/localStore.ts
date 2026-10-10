// IndexedDB-ভিত্তিক লোকাল persistence — শুধু এই ফাইল দিয়ে (Arch §১ নং ৬)।
// critical data localStorage-এ নয়; logout-এ clearAll() (Arch §৫)।
const DB = "blog-local";
const STORE = "kv";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB অনুপলব্ধ"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB খোলা যায়নি"));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB লেখা/পড়া ব্যর্থ"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB abort"));
    });
  } finally {
    db.close();
  }
}

/** একটাই transaction-এ একাধিক কাজ (খোঁজ-index: অনেক ছোট entry একসাথে লেখা/পড়া/মোছা) */
async function batch<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore, done: (v: T) => void) => void,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let out: T | undefined;
      fn(tx.objectStore(STORE), (v) => {
        out = v;
      });
      tx.oncomplete = () => resolve(out as T);
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB লেখা/পড়া ব্যর্থ"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB abort"));
    });
  } finally {
    db.close();
  }
}

const prefixRange = (prefix: string) => IDBKeyRange.bound(prefix, `${prefix}￿`);

export const localStore = {
  /** prefix-যুক্ত সব (key, value) — একটাই transaction */
  entries: <T>(prefix: string) =>
    batch<[string, T][]>("readonly", (s, done) => {
      const out: [string, T][] = [];
      const req = s.openCursor(prefixRange(prefix));
      req.onsuccess = () => {
        const c = req.result;
        if (c) {
          out.push([String(c.key), c.value as T]);
          c.continue();
        } else done(out);
      };
    }),
  /** একাধিক put/delete একটাই transaction-এ (সব-অথবা-কিছুই-না) */
  writeMany: (puts: [string, unknown][], deletes: string[] = []) =>
    batch<void>("readwrite", (s) => {
      for (const [k, v] of puts) s.put(v, k);
      for (const k of deletes) s.delete(k);
    }),
  get: <T>(key: string) => run<T | undefined>("readonly", (s) => s.get(key)),
  set: (key: string, value: unknown) =>
    run("readwrite", (s) => s.put(value, key)).then(() => undefined),
  delete: (key: string) => run("readwrite", (s) => s.delete(key)).then(() => undefined),
  keys: () => run<IDBValidKey[]>("readonly", (s) => s.getAllKeys()).then((k) => k.map(String)),
  /** logout-এ: লোকাল ড্রাফট ও search-index মোছা (UI-পছন্দ localStorage-এ, থাকে) */
  clearAll: () => run("readwrite", (s) => s.clear()).then(() => undefined),
};

/** UI-পছন্দ (থিম/আরাম-সেটিং) — localStorage, শুধু এই ফাইল দিয়ে (Arch §১ নং ৬); sync, ব্যর্থ হলে নীরবে উপেক্ষা */
export const prefs = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // স্টোরেজ বন্ধ/পূর্ণ: পছন্দ এই সেশনেই প্রযোজ্য থাকে
    }
  },
};
