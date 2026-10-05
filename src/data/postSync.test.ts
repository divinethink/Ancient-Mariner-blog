import { describe, expect, it } from "vitest";
import type { LocalDraft } from "@/data/draftStore";
import { syncLocalDraft } from "./postSync";
import { fakeRepo } from "./syncTestKit";

const local = (o: Partial<LocalDraft> = {}): LocalDraft => ({
  id: "p1", title: "শিরোনাম", body: '{"a":1}', excerpt: "সার", wordCount: 3,
  createdAt: 1, updatedAt: 500, dirty: true, ...o,
});

describe("syncLocalDraft", () => {
  it("রিমোটে নেই → create (draft)", async () => {
    const { repo, posts } = fakeRepo();
    const r = await syncLocalDraft(repo, local(), undefined);
    expect(r).toMatchObject({ kind: "synced", status: "draft", hasUnpublished: false });
    expect(posts.get("p1")?.title).toBe("শিরোনাম");
  });
  it("draft লেখা → posts-এ update; base মিললে conflict নয়", async () => {
    const f = fakeRepo();
    await f.repo.create({ id: "p1", title: "পুরনো", body: "{}" });
    const base = f.posts.get("p1")!.updatedAt.getTime();
    const r = await syncLocalDraft(f.repo, local(), base);
    expect(r.kind).toBe("synced");
    expect(f.posts.get("p1")?.body).toBe('{"a":1}');
    expect(f.drafts.size).toBe(0);
  });
  it("অন্য কেউ বদলালে (base ≠ রিমোট) → conflict, কিছু লেখা হয় না", async () => {
    const f = fakeRepo();
    await f.repo.create({ id: "p1", title: "পুরনো", body: "{}" });
    const r = await syncLocalDraft(f.repo, local(), 1);
    expect(r.kind).toBe("conflict");
    expect(f.posts.get("p1")?.title).toBe("পুরনো");
  });
  it("retry: একই কনটেন্ট আগেই রিমোটে থাকলে conflict নয়, base ছাড়াও", async () => {
    const f = fakeRepo();
    await f.repo.create({ id: "p1", title: "শিরোনাম", body: '{"a":1}', excerpt: "সার" });
    const r = await syncLocalDraft(f.repo, local(), undefined);
    expect(r.kind).toBe("synced");
    expect(f.calls.filter((c) => c === "update")).toHaveLength(0);
  });
  it("প্রকাশিত লেখা → drafts-এ saveEdit, posts অপরিবর্তিত", async () => {
    const f = fakeRepo();
    await f.repo.create({ id: "p1", title: "পুরনো", body: "{}" });
    await f.repo.update("p1", { status: "published", visibility: "public" });
    const base = f.posts.get("p1")!.updatedAt.getTime();
    const r = await syncLocalDraft(f.repo, local(), base);
    expect(r).toMatchObject({ kind: "synced", status: "published", hasUnpublished: true });
    expect(f.posts.get("p1")?.title).toBe("পুরনো");
    expect(f.drafts.get("p1")?.title).toBe("শিরোনাম");
    // বিতীয় sync: base = ফেরত stamp → conflict নয়
    if (r.kind !== "synced") throw new Error();
    const r2 = await syncLocalDraft(f.repo, local({ title: "আবার", updatedAt: 600 }), r.baseMs);
    expect(r2.kind).toBe("synced");
    expect(f.drafts.get("p1")?.title).toBe("আবার");
  });
  it("প্রকাশিত + কনটেন্ট posts-এর সমান + drafts নেই → কিছু লেখা হয় না", async () => {
    const f = fakeRepo();
    await f.repo.create({ id: "p1", title: "শিরোনাম", body: '{"a":1}', excerpt: "সার" });
    await f.repo.update("p1", { status: "published" });
    const r = await syncLocalDraft(f.repo, local(), undefined);
    expect(r).toMatchObject({ kind: "synced", hasUnpublished: false });
    expect(f.drafts.size).toBe(0);
  });
  it("ট্র্যাশে → trashed", async () => {
    const f = fakeRepo();
    await f.repo.create({ id: "p1", title: "x", body: "{}" });
    await f.repo.update("p1", { status: "trashed" });
    expect((await syncLocalDraft(f.repo, local(), undefined)).kind).toBe("trashed");
  });
});
