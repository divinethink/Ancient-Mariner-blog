// লেখার লোকাল autosave (IndexedDB, Arch §১২ autosave নীতি-ক) — `localStore`-এর ওপর পাতলা স্তর।
// `dirty` = লোকাল সম্পাদনা এখনো Firestore-এ যায়নি; logout-এ এর জন্যই সতর্কতা।
// race-নিরাপত্তা: sync-তথ্য আলাদা key `sync:<id>`-এ (draft-key শুধু editor লেখে, sync-key শুধু sync) —
// তাই sync শেষে editor-এর নতুন লেখা কখনো মুছে যায় না; dirty = draft.updatedAt > sync.syncedUpdatedAt (পড়ার সময় হিসাব)।
import { localStore } from "@/data/localStore";

export type LocalDraft = {
  id: string;
  title: string;
  body: string; // Tiptap JSON string
  excerpt: string;
  wordCount: number;
  createdAt: number; // ms
  updatedAt: number; // ms
  /** সংরক্ষণে লেখা হয় (পুরনো ড্রাফটের সাথে সামঞ্জস্য); পড়ার সময় sync-তথ্য থেকে পুনর্গণিত */
  dirty: boolean;
  /** প্যানেলে হাতে লেখা excerpt থাকলে autosave তা আর বদলায় না */
  excerptManual?: boolean;
};
/** `baseMs` = রিমোটের যে `updatedAt` আমি শেষ দেখেছি/লিখেছি; `syncedUpdatedAt` = যে লোকাল সংস্করণ পর্যন্ত রিমোটে আছে */
export type SyncMeta = { baseMs?: number; syncedUpdatedAt: number };
export type EditorPos = { from: number; to: number; scrollY: number };

type KV = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
};

const DRAFT = "draft:";
const POS = "pos:";
const SYNC = "sync:";

export function createDraftStore(kv: KV) {
  const withDirty = (d: LocalDraft, m: SyncMeta | undefined): LocalDraft => ({
    ...d,
    dirty: !m || d.updatedAt > m.syncedUpdatedAt,
  });
  const getSync = (id: string) => kv.get<SyncMeta>(SYNC + id);
  const listDrafts = async (): Promise<LocalDraft[]> => {
    const keys = (await kv.keys()).filter((k) => k.startsWith(DRAFT));
    const all = await Promise.all(
      keys.map(async (k) => {
        const d = await kv.get<LocalDraft>(k);
        return d ? withDirty(d, await getSync(d.id)) : undefined;
      }),
    );
    return all.filter((d): d is LocalDraft => !!d).sort((a, b) => b.updatedAt - a.updatedAt);
  };
  return {
    saveDraft: (d: LocalDraft) => kv.set(DRAFT + d.id, d),
    loadDraft: async (id: string): Promise<LocalDraft | undefined> => {
      const d = await kv.get<LocalDraft>(DRAFT + id);
      return d ? withDirty(d, await getSync(id)) : undefined;
    },
    deleteDraft: async (id: string) => {
      await kv.delete(DRAFT + id);
      await kv.delete(POS + id);
      await kv.delete(SYNC + id);
    },
    /** সর্বশেষ সম্পাদনা আগে */
    listDrafts,
    hasUnsynced: async (): Promise<boolean> => (await listDrafts()).some((d) => d.dirty),
    getSync,
    setSync: (id: string, m: SyncMeta) => kv.set(SYNC + id, m),
    savePos: (id: string, pos: EditorPos) => kv.set(POS + id, pos),
    loadPos: (id: string) => kv.get<EditorPos>(POS + id),
  };
}

export const draftStore = createDraftStore(localStore);
