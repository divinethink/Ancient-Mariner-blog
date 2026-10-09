// দৈনিক-লক্ষ্যের লোকাল baseline (IndexedDB, প্রতি-ডিভাইস; P7a)। key `goal:<YYYY-MM-DD>` (সাইট-timezone-এর দিন)।
// শুধু আজকের key রাখে — পুরনো দিনের key লেখার সময় মোছে। logout-এ clearAll()-এ যায় (লক্ষ্য নতুন করে শুরু — ক্ষতি নেই)।
import { localStore } from "@/data/localStore";
import { parseGoalDay, recordWords, wordsToday, type GoalDay } from "@/lib/goal";

type KV = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
};
const P = "goal:";

export function createGoalStore(kv: KV) {
  const load = async (day: string): Promise<GoalDay> => parseGoalDay(await kv.get<unknown>(P + day));
  return {
    load,
    wordsToday: async (day: string): Promise<number> => wordsToday(await load(day)),
    /** editor-এর লোকাল সেভের পর; `initial` = editor খোলার সময়ের শব্দ-সংখ্যা */
    record: async (day: string, postId: string, words: number, initial: number): Promise<void> => {
      await kv.set(P + day, recordWords(await load(day), postId, words, initial));
      const stale = (await kv.keys()).filter((k) => k.startsWith(P) && k !== P + day);
      await Promise.all(stale.map((k) => kv.delete(k)));
    },
  };
}

export const goalStore = createGoalStore(localStore);
