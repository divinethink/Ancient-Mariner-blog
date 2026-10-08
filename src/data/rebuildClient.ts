// Owner-CSR: পাবলিক সাইট rebuild-এর অনুরোধ (`POST /api/owner/rebuild`) ও 'শেষ সাইট-বদল' চিহ্ন (Arch §১২)।
// চিহ্ন আগে লেখা হয় — অনুরোধ ব্যর্থ হলেও ৫ মিনিট পরে 'হালনাগাদ হয়নি' সতর্কতা আসে (lib/buildStatus)।
import { localStore } from "./localStore";
import { withRetry } from "./retry";

export const REBUILD_MARK_KEY = "site:changedAt";

/** ব্যর্থ উত্তর থেকে প্রকৃত কারণ: "502 dispatch_failed — GitHub dispatch 403: …" */
export async function readFailure(res: Response): Promise<string> {
  const j = (await res.json().catch(() => ({}))) as { error?: unknown; detail?: unknown };
  const parts = [typeof j.error === "string" ? j.error : "", typeof j.detail === "string" ? j.detail : ""].filter(Boolean);
  return `${res.status}${parts.length ? ` ${parts.join(" — ")}` : ""}`;
}

let lastFailure = "";
/** সর্বশেষ rebuild-ব্যর্থতার কারণ (খালি = নেই) */
export const lastRebuildFailure = () => lastFailure;

/** সাইট-প্রভাবিত ক্রিয়ার পর ডাকা হয়; সফল অনুরোধ = true */
export async function triggerSiteRebuild(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  lastFailure = "";
  await localStore.set(REBUILD_MARK_KEY, Date.now()).catch(() => undefined);
  try {
    await withRetry(
      async (signal) => {
        const res = await fetchImpl("/api/owner/rebuild", { method: "POST", signal });
        if (!res.ok) {
          lastFailure = await readFailure(res);
          throw new Error(`rebuild ${lastFailure}`);
        }
      },
      { retries: 2 },
    );
    return true;
  } catch (e) {
    if (!lastFailure) lastFailure = e instanceof Error ? e.message : "network";
    return false;
  }
}

export const readRebuildMark = (): Promise<number | undefined> =>
  localStore.get<number>(REBUILD_MARK_KEY).catch(() => undefined);
