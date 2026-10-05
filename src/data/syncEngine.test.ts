import { describe, expect, it } from "vitest";
import { createDraftStore, type LocalDraft } from "./draftStore";
import { createSyncEngine, syncAllDirty, type SyncStatus } from "./syncEngine";
import { fakeRepo, memoryKV } from "./syncTestKit";

const draft = (o: Partial<LocalDraft> = {}): LocalDraft => ({
  id: "p1", title: "শিরোনাম", body: "{}", excerpt: "", wordCount: 1, createdAt: 1, updatedAt: 500, dirty: true, ...o,
});
function setup() {
  const f = fakeRepo();
  const store = createDraftStore(memoryKV());
  const seen: SyncStatus[] = [];
  const eng = createSyncEngine({ postId: "p1", getRepo: async () => f.repo, store, onStatus: (s) => seen.push(s) });
  return { f, store, seen, eng };
}

describe("syncEngine", () => {
  it("dirty ড্রাফট sync হলে ক্লিন হয়; দ্বিতীয় syncNow কিছু লেখে না", async () => {
    const { f, store, eng } = setup();
    await store.saveDraft(draft());
    await eng.syncNow();
    expect(f.posts.get("p1")?.title).toBe("শিরোনাম");
    expect((await store.loadDraft("p1"))?.dirty).toBe(false);
    await eng.syncNow();
    expect(f.calls).toEqual(["create"]);
    eng.dispose();
  });
  it("sync-এর সময় আসা নতুন টাইপ হারায় না — আবার dirty/pending", async () => {
    const { f, store, eng, seen } = setup();
    await store.saveDraft(draft());
    const orig = f.repo.create;
    f.repo.create = async (i) => {
      await store.saveDraft(draft({ title: "নতুন টাইপ", updatedAt: 600 })); // sync চলাকালে editor লিখল
      return orig(i);
    };
    await eng.syncNow();
    const l = await store.loadDraft("p1");
    expect(l?.title).toBe("নতুন টাইপ");
    expect(l?.dirty).toBe(true);
    expect(seen.at(-1)).toBe("pending");
    eng.dispose();
  });
  it("conflict: স্থগিত; keepMine-এ রিমোটের stamp base হয়ে লেখা যায়", async () => {
    const { f, store, eng } = setup();
    await f.repo.create({ id: "p1", title: "অন্য ডিভাইস", body: "{}" });
    await store.saveDraft(draft());
    await store.setSync("p1", { baseMs: 1, syncedUpdatedAt: 0 });
    await eng.syncNow();
    expect(eng.status).toBe("conflict");
    expect(f.posts.get("p1")?.title).toBe("অন্য ডিভাইস");
    await eng.keepMine();
    expect(f.posts.get("p1")?.title).toBe("শিরোনাম");
    expect(eng.status).toBe("synced");
    eng.dispose();
  });
  it("ব্যর্থ হলে failed, লোকাল ড্রাফট অক্ষত dirty", async () => {
    const { f, store, eng } = setup();
    await store.saveDraft(draft());
    f.repo.get = async () => {
      throw new Error("offline");
    };
    await expect(eng.syncNow()).rejects.toThrow();
    expect(eng.status).toBe("failed");
    expect((await store.loadDraft("p1"))?.dirty).toBe(true);
    eng.dispose();
  });
  it("syncAllDirty: একটা ব্যর্থ হলেও বাকিগুলো যায়", async () => {
    const f = fakeRepo();
    const store = createDraftStore(memoryKV());
    await store.saveDraft(draft({ id: "a" }));
    await store.saveDraft(draft({ id: "b" }));
    const get = f.repo.get;
    f.repo.get = async (id) => {
      if (id === "a") throw new Error("x");
      return get(id);
    };
    expect(await syncAllDirty(f.repo, store)).toBe(1);
    expect((await store.loadDraft("a"))?.dirty).toBe(true);
    expect((await store.loadDraft("b"))?.dirty).toBe(false);
  });
});
