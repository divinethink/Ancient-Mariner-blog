import { describe, expect, it } from "vitest";
import { createDraftStore, type LocalDraft } from "./draftStore";

function memoryKV() {
  const m = new Map<string, unknown>();
  return {
    get: async <T>(k: string) => m.get(k) as T | undefined,
    set: async (k: string, v: unknown) => void m.set(k, v),
    delete: async (k: string) => void m.delete(k),
    keys: async () => [...m.keys()],
  };
}
const d = (id: string, updatedAt: number, dirty = true): LocalDraft => ({
  id,
  title: "শিরোনাম " + id,
  body: "{}",
  excerpt: "",
  wordCount: 3,
  createdAt: 1,
  updatedAt,
  dirty,
});

describe("draftStore", () => {
  it("save/load/delete (সাথে caret-অবস্থান)", async () => {
    const s = createDraftStore(memoryKV());
    await s.saveDraft(d("a", 10));
    await s.savePos("a", { from: 1, to: 2, scrollY: 300 });
    expect((await s.loadDraft("a"))?.title).toBe("শিরোনাম a");
    expect(await s.loadPos("a")).toEqual({ from: 1, to: 2, scrollY: 300 });
    await s.deleteDraft("a");
    expect(await s.loadDraft("a")).toBeUndefined();
    expect(await s.loadPos("a")).toBeUndefined();
  });
  it("listDrafts: নতুন আগে; pos-key গোনা হয় না", async () => {
    const s = createDraftStore(memoryKV());
    await s.saveDraft(d("old", 1));
    await s.saveDraft(d("new", 5));
    await s.savePos("new", { from: 0, to: 0, scrollY: 0 });
    expect((await s.listDrafts()).map((x) => x.id)).toEqual(["new", "old"]);
  });
  it("hasUnsynced: শুধু dirty থাকলে true", async () => {
    const s = createDraftStore(memoryKV());
    expect(await s.hasUnsynced()).toBe(false);
    await s.saveDraft(d("a", 1, false));
    expect(await s.hasUnsynced()).toBe(false);
    await s.saveDraft(d("b", 2, true));
    expect(await s.hasUnsynced()).toBe(true);
  });
  it("একই id-তে আবার save = প্রতিস্থাপন (idempotent)", async () => {
    const s = createDraftStore(memoryKV());
    await s.saveDraft(d("a", 1));
    await s.saveDraft({ ...d("a", 2), title: "নতুন" });
    const all = await s.listDrafts();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("নতুন");
  });
});
