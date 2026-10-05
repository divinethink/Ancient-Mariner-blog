// Owner-CSR: পাবলিক সাইট rebuild-এর অনুরোধ (`POST /api/owner/rebuild`) ও 'শেষ সাইট-বদল' চিহ্ন (Arch §১২)।
// চিহ্ন আগে লেখা হয় — অনুরোধ ব্যর্থ হলেও ৫ মিনিট পরে 'হালনাগাদ হয়নি' সতর্কতা আসে (lib/buildStatus)।
import { localStore } from "./localStore";
import { withRetry } from "./retry";

export const REBUILD_MARK_KEY = "site:changedAt";

/** সাইট-প্রভাবিত ক্রিয়ার পর ডাকা হয়; সফল অনুরোধ = true */
export async function triggerSiteRebuild(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  await localStore.set(REBUILD_MARK_KEY, Date.now()).catch(() => undefined);
  try {
    await withRetry(
      async (signal) => {
        const res = await fetchImpl("/api/owner/rebuild", { method: "POST", signal });
        if (!res.ok) throw new Error(`rebuild ${res.status}`);
      },
      { retries: 2 },
    );
    return true;
  } catch {
    return false;
  }
}

export const readRebuildMark = (): Promise<number | undefined> =>
  localStore.get<number>(REBUILD_MARK_KEY).catch(() => undefined);
