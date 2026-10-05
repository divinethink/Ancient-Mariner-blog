// লেখার লোকাল autosave (IndexedDB, Arch §১২ autosave নীতি-ক) — `localStore`-এর ওপর পাতলা স্তর।
// `dirty = true` মানে এখনো Firestore-এ যায়নি (sync P2a-২খ-তে); logout-এ এর জন্যই সতর্কতা।
import { localStore } from "@/data/localStore";

export type LocalDraft = {
  id: string;
  title: string;
  body: string; // Tiptap JSON string
  excerpt: string;
  wordCount: number;
  createdAt: number; // ms
  updatedAt: number; // ms
  dirty: boolean;
};
export type EditorPos = { from: number; to: number; scrollY: number };

type KV = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
};

const DRAFT = "draft:";
const POS = "pos:";

export function createDraftStore(kv: KV) {
  return {
    saveDraft: (d: LocalDraft) => kv.set(DRAFT + d.id, d),
    loadDraft: (id: string) => kv.get<LocalDraft>(DRAFT + id),
    deleteDraft: async (id: string) => {
      await kv.delete(DRAFT + id);
      await kv.delete(POS + id);
    },
    /** সর্বশেষ সম্পাদনা আগে */
    listDrafts: async (): Promise<LocalDraft[]> => {
      const keys = (await kv.keys()).filter((k) => k.startsWith(DRAFT));
      const all = await Promise.all(keys.map((k) => kv.get<LocalDraft>(k)));
      return all.filter((d): d is LocalDraft => !!d).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    hasUnsynced: async (): Promise<boolean> => (await createDraftStore(kv).listDrafts()).some((d) => d.dirty),
    savePos: (id: string, pos: EditorPos) => kv.set(POS + id, pos),
    loadPos: (id: string) => kv.get<EditorPos>(POS + id),
  };
}

export const draftStore = createDraftStore(localStore);
