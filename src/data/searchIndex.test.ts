import { describe, expect, it } from "vitest";
import {
  ideaEntry,
  postEntry,
  SEARCH_INDEX_VERSION,
  SYNC_OVERLAP_MS,
  type SearchEntry,
  type SearchKind,
} from "@/lib/search";
import {
  syncIndex,
  verifyEntry,
  type IndexMeta,
  type IndexStore,
  type SearchSource,
} from "./searchIndex";

const T0 = 10_000_000_000;
const body = (t: string) =>
  JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
  });
const P = (id: string, text: string, updatedAt: number, status = "draft") =>
  postEntry({ id, title: `শি-${id}`, excerpt: "", body: body(text), status, updatedAt });

function memStore(): IndexStore & { map: Map<string, SearchEntry>; meta?: IndexMeta } {
  const s = {
    map: new Map<string, SearchEntry>(),
    meta: undefined as IndexMeta | undefined,
    getMeta: async () => s.meta,
    setMeta: async (m: IndexMeta) => void (s.meta = m),
    all: async () => [...s.map.values()],
    write: async (puts: SearchEntry[], dels: string[]) => {
      for (const p of puts) s.map.set(p.key, p);
      for (const k of dels) s.map.delete(k);
    },
  };
  return s;
}

/** সার্ভারের নকল: docs + কোন since-তে fetch হলো তার লগ */
function fakeSource(docs: SearchEntry[]) {
  const calls: { kind: SearchKind; since: number | null }[] = [];
  const src: SearchSource & { docs: SearchEntry[]; calls: typeof calls; failKind?: SearchKind } = {
    docs,
    calls,
    async fetch(kind, since) {
      calls.push({ kind, since });
      if (src.failKind === kind) throw new Error("নেট নেই");
      return src.docs.filter((d) => d.kind === kind && (since === null || d.updatedAt >= since));
    },
    async exists(kind, id) {
      return src.docs.some((d) => d.kind === kind && d.id === id);
    },
  };
  return src;
}

describe("syncIndex", () => {
  it("প্রথমবার পূর্ণ sync; পরে শুধু বদলানোগুলো (overlap-সহ), পুরনো entry অক্ষত", async () => {
    const st = memStore();
    const src = fakeSource([
      P("a", "এক", T0),
      P("b", "দুই", T0 + 1000),
      ideaEntry({ id: "i", text: "আইডিয়া", updatedAt: T0 }),
    ]);
    const r1 = await syncIndex(src, st, { now: () => 1 });
    expect(r1).toMatchObject({ full: true, changed: 3, total: 3 });
    expect(src.calls.every((c) => c.since === null)).toBe(true);
    expect(st.meta?.v).toBe(SEARCH_INDEX_VERSION);

    src.calls.length = 0;
    src.docs[1] = P("b", "দুই-বদল", T0 + SYNC_OVERLAP_MS * 3);
    const r2 = await syncIndex(src, st);
    expect(r2.full).toBe(false);
    expect(src.calls.find((c) => c.kind === "post")?.since).toBe(T0 + 1000 - SYNC_OVERLAP_MS);
    expect(st.map.get("post:b")?.text).toContain("দুই-বদল");
    expect(st.map.get("post:a")?.text).toContain("এক");
    expect(r2.total).toBe(3);
  });

  it("ট্র্যাশে গেলে index থেকে সরে; ফিরলে আবার আসে", async () => {
    const st = memStore();
    const src = fakeSource([P("a", "এক", T0), P("b", "দুই", T0)]);
    await syncIndex(src, st);
    src.docs[0] = P("a", "এক", T0 + 10 * SYNC_OVERLAP_MS, "trashed");
    const r = await syncIndex(src, st);
    expect(st.map.has("post:a")).toBe(false);
    expect(r.removed).toBe(1);
    src.docs[0] = P("a", "এক", T0 + 20 * SYNC_OVERLAP_MS, "draft");
    await syncIndex(src, st);
    expect(st.map.has("post:a")).toBe(true);
  });

  it("স্থায়ীভাবে মোছা লেখা শুধু পূর্ণ sync-এ (rebuild) সরে", async () => {
    const st = memStore();
    const src = fakeSource([P("a", "এক", T0), P("b", "দুই", T0)]);
    await syncIndex(src, st);
    src.docs.splice(0, 1); // a স্থায়ীভাবে মোছা
    await syncIndex(src, st);
    expect(st.map.has("post:a")).toBe(true); // delta ধরে না — জানা সীমা
    const r = await syncIndex(src, st, { full: true });
    expect(st.map.has("post:a")).toBe(false);
    expect(r.removed).toBe(1);
    expect(st.map.has("post:b")).toBe(true);
  });

  it("ব্যর্থ sync পুরনো index নষ্ট করে না, ব্যর্থ ধরনের cursor এগোয় না", async () => {
    const st = memStore();
    const src = fakeSource([P("a", "এক", T0), ideaEntry({ id: "i", text: "আই", updatedAt: T0 })]);
    await syncIndex(src, st);
    const before = JSON.stringify(st.meta?.cursors);
    src.docs.push(P("c", "তিন", T0 + 100 * SYNC_OVERLAP_MS));
    src.failKind = "idea";
    await expect(syncIndex(src, st)).rejects.toThrow("নেট নেই");
    expect(st.map.has("post:a")).toBe(true);
    expect(st.map.has("post:c")).toBe(true); // আগের ধরন সম্পূর্ণ হয়েছিল
    expect(st.meta?.cursors.idea).toBe(JSON.parse(before).idea);
    src.failKind = undefined;
    await syncIndex(src, st); // পরের চেষ্টায় আবার চলে (single-flight আটকে থাকে না)
    expect(st.map.size).toBe(3);
  });

  it("index-রূপ (version) বদলালে পুরনো entry বাদ দিয়ে নতুন করে", async () => {
    const st = memStore();
    const src = fakeSource([P("a", "এক", T0)]);
    await syncIndex(src, st);
    st.map.set("post:ghost", P("ghost", "ভূত", T0));
    st.meta = { ...(st.meta as IndexMeta), v: SEARCH_INDEX_VERSION - 1 };
    const r = await syncIndex(src, st);
    expect(r.full).toBe(true);
    expect(st.map.has("post:ghost")).toBe(false);
    expect(st.meta?.v).toBe(SEARCH_INDEX_VERSION);
  });

  it("একসাথে দুই sync ⇒ একটাই চলে", async () => {
    const st = memStore();
    const src = fakeSource([P("a", "এক", T0)]);
    const [x, y] = [syncIndex(src, st), syncIndex(src, st)];
    expect(x).toBe(y);
    await x;
    expect(src.calls.filter((c) => c.kind === "post")).toHaveLength(1);
  });
});

describe("verifyEntry", () => {
  it("আছে ⇒ true; নেই ⇒ false ও index থেকে মোছা; নেট-ব্যর্থ ⇒ null, index অক্ষত", async () => {
    const st = memStore();
    const src = fakeSource([P("a", "এক", T0)]);
    await syncIndex(src, st);
    expect(await verifyEntry(src, st, { kind: "post", id: "a" })).toBe(true);
    src.docs.length = 0;
    expect(await verifyEntry(src, st, { kind: "post", id: "a" })).toBe(false);
    expect(st.map.has("post:a")).toBe(false);
    st.map.set("post:z", P("z", "জ", T0));
    src.exists = async () => {
      throw new Error("offline");
    };
    expect(await verifyEntry(src, st, { kind: "post", id: "z" })).toBeNull();
    expect(st.map.has("post:z")).toBe(true);
  });
});
