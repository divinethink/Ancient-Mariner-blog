// Sync engine (framework-মুক্ত, test-যোগ্য): timer + exclusive-mutex + status। React hook এটাকে মোড়ায়।
// নীতি: idle ≥৫s / blur / manual, দুই sync-এর ব্যবধান ≥১৫s (Arch §১২-খ); লেখা কখনো মোছে না — ব্যর্থ হলে লোকালেই থাকে।
import type { PostRepo } from "@/data/postRepo";
import type { createDraftStore } from "@/data/draftStore";
import { syncLocalDraft, type SyncResult } from "@/data/postSync";
import { RETRY_MS, syncDelay, type SyncReason } from "@/lib/syncPlan";

export type SyncStatus = "idle" | "pending" | "syncing" | "synced" | "failed" | "conflict" | "trashed";
type Store = ReturnType<typeof createDraftStore>;

export type EngineDeps = {
  postId: string;
  getRepo: () => Promise<PostRepo>;
  store: Store;
  onStatus: (s: SyncStatus) => void;
  /** প্রতিটি সফল sync-এর পর (প্রকাশিত অবস্থা/অপ্রকাশিত পরিবর্তন জানাতে) */
  onSynced?: (r: Extract<SyncResult, { kind: "synced" }>) => void;
  now?: () => number;
};

export function createSyncEngine({ postId, getRepo, store, onStatus, onSynced, now = Date.now }: EngineDeps) {
  let status: SyncStatus = "idle";
  let lastEditAt = 0;
  let lastSyncAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chain: Promise<unknown> = Promise.resolve();
  let conflictRemoteMs: number | undefined;
  let dead = false;

  const set = (s: SyncStatus) => {
    status = s;
    if (!dead) onStatus(s);
  };

  /** একসাথে একটাই রিমোট-লেখা চলে (sync ও panel-ক্রিয়া ক্রমানুসারে) — ব্যর্থতা chain ভাঙে না */
  function exclusive<T>(fn: (repo: PostRepo) => Promise<T>): Promise<T> {
    const run = chain.then(async () => fn(await getRepo()));
    chain = run.catch(() => undefined);
    return run;
  }

  function schedule(reason: SyncReason, delayOverride?: number) {
    clearTimeout(timer);
    if (dead || status === "conflict" || status === "trashed") return;
    const delay = delayOverride ?? syncDelay(reason, now(), lastEditAt, lastSyncAt);
    timer = setTimeout(() => void syncNow().catch(() => undefined), delay); // ব্যর্থতা status/retry-তে ধরা
  }

  /** ক্লিন হলে কিছু করে না; conflict/trashed হলে নতুন করে লেখে না */
  async function syncNow(): Promise<SyncResult | { kind: "clean" }> {
    clearTimeout(timer);
    try {
      return await exclusive(async (repo) => {
        const local = await store.loadDraft(postId);
        if (!local || !local.dirty) {
          if (status !== "conflict" && status !== "trashed") set("synced");
          return { kind: "clean" } as const;
        }
        set("syncing");
        const meta = await store.getSync(postId);
        const res = await syncLocalDraft(repo, local, meta?.baseMs);
        if (res.kind === "synced") {
          await store.setSync(postId, { baseMs: res.baseMs, syncedUpdatedAt: local.updatedAt });
          lastSyncAt = now();
          conflictRemoteMs = undefined;
          if (!dead) onSynced?.(res);
          // sync চলার সময় নতুন টাইপ হয়ে থাকলে (draft-key এগিয়েছে) আবার pending
          const after = await store.loadDraft(postId);
          if (after?.dirty) {
            set("pending");
            schedule("idle");
          } else set("synced");
        } else if (res.kind === "conflict") {
          conflictRemoteMs = res.remoteMs;
          set("conflict");
        } else set("trashed");
        return res;
      });
    } catch (e) {
      set("failed");
      schedule("idle", RETRY_MS);
      throw e;
    }
  }

  return {
    get status() {
      return status;
    },
    /** লোকাল সেভের পর ডাকুন */
    edited() {
      lastEditAt = now();
      if (status === "conflict" || status === "trashed") return;
      set("pending");
      schedule("idle");
    },
    blur() {
      if (status === "pending" || status === "failed") schedule("blur");
    },
    syncNow,
    exclusive,
    /** ক্রিয়ার পর (publish ইত্যাদি) রিমোটের নতুন stamp base-এ বসানো — নিজের লেখা যেন conflict না হয় */
    async adoptBase(baseMs: number) {
      const meta = await store.getSync(postId);
      await store.setSync(postId, { baseMs, syncedUpdatedAt: meta?.syncedUpdatedAt ?? 0 });
    },
    /** conflict: "আমার লেখা রাখুন" — রিমোটের stamp base ধরে আবার sync */
    async keepMine() {
      if (conflictRemoteMs === undefined) return;
      const meta = await store.getSync(postId);
      await store.setSync(postId, { baseMs: conflictRemoteMs, syncedUpdatedAt: meta?.syncedUpdatedAt ?? 0 });
      conflictRemoteMs = undefined;
      set("pending");
      return syncNow();
    },
    dispose() {
      dead = true;
      clearTimeout(timer);
    },
    /** StrictMode-এর mount→cleanup→mount-এ আবার সক্রিয় */
    revive() {
      dead = false;
    },
  };
}

/** লাইব্রেরি খোলা/logout-এ: সব dirty লোকাল ড্রাফট একবার করে sync; একটা ব্যর্থ হলে বাকিগুলো চলে। কতটা সফল তা ফেরত */
export async function syncAllDirty(repo: PostRepo, store: Store): Promise<number> {
  let ok = 0;
  for (const d of (await store.listDrafts()).filter((x) => x.dirty)) {
    try {
      const meta = await store.getSync(d.id);
      const res = await syncLocalDraft(repo, d, meta?.baseMs);
      if (res.kind === "synced") {
        await store.setSync(d.id, { baseMs: res.baseMs, syncedUpdatedAt: d.updatedAt });
        ok++;
      }
    } catch {
      // ব্যর্থ ড্রাফট dirty থাকে; পরের সুযোগে আবার
    }
  }
  return ok;
}
