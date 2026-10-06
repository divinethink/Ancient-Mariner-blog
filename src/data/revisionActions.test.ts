import { describe, expect, it } from "vitest";
import type { Draft, PostRepo, PostWithId } from "@/data/postRepo";
import type { CreateRevisionInput, RevisionRepo, RevisionWithId } from "@/data/revisionRepo";
import { maybeIntervalSnapshot, restoreRevision, snapshotCurrent, snapshotIfChanged } from "@/data/revisionActions";
import { makeExcerpt } from "@/lib/editorDoc";
import { REVISION_INTERVAL_MS } from "@/lib/revision";

const body = (t: string) =>
  JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] });

function fakeRevs() {
  const all: RevisionWithId[] = [];
  const r: RevisionRepo & { all: RevisionWithId[]; failNext: boolean } = {
    all,
    failNext: false,
    list: async (t, o) => all.filter((x) => x.targetId === t).sort((a, b) => b.versionNumber - a.versionNumber).slice(0, o?.limit ?? 20),
    get: async (id) => all.find((x) => x.id === id) ?? null,
    create: async (i: CreateRevisionInput) => {
      if (r.failNext) throw new Error("boom");
      const v = all.filter((x) => x.targetId === i.targetId).length + 1;
      const x = { id: `r${all.length + 1}`, targetType: "post", targetId: i.targetId, snapshot: i.snapshot, versionNumber: v, trigger: i.trigger, ownerUid: "o", createdAt: new Date(), updatedAt: new Date(), schemaVersion: 1 } as RevisionWithId;
      all.push(x);
      return x;
    },
  };
  return r;
}

type P = { status: string; title: string; body: string; excerpt: string; draft?: { title: string; body: string; excerpt: string } };
function fakePosts(p: P | null) {
  const calls: string[] = [];
  const repo = {
    calls,
    cur: p,
    get: async () => (repo.cur ? ({ id: "p1", ...repo.cur } as unknown as PostWithId) : null),
    getDraft: async () => (repo.cur?.draft ? ({ ...repo.cur.draft } as unknown as Draft) : null),
    saveEdit: async (_id: string, e: { title: string; body: string; excerpt: string }) => {
      calls.push("saveEdit");
      repo.cur = { ...repo.cur!, draft: e };
      return new Date();
    },
    update: async (_id: string, patch: { body?: string; excerpt?: string; wordCount?: number }) => {
      calls.push(`update:${patch.wordCount}`);
      repo.cur = { ...repo.cur!, ...patch } as P;
      return new Date();
    },
  };
  return repo as typeof repo & PostRepo;
}

describe("snapshotIfChanged / snapshotCurrent", () => {
  it("একই body দ্বিতীয়বার বানায় না; বদলালে বানায়", async () => {
    const revs = fakeRevs();
    expect(await snapshotIfChanged(revs, "p1", body("এক"), "manual")).not.toBeNull();
    expect(await snapshotIfChanged(revs, "p1", body("এক"), "manual")).toBeNull();
    expect(await snapshotIfChanged(revs, "p1", body("দুই"), "interval")).not.toBeNull();
    expect(revs.all.length).toBe(2);
  });
  it("প্রকাশিত লেখায় drafts-এর body; trashed/নেই ⇒ null", async () => {
    const revs = fakeRevs();
    const posts = fakePosts({ status: "published", title: "t", body: body("প্রকাশিত"), excerpt: "", draft: { title: "t", body: body("খসড়া"), excerpt: "" } });
    await snapshotCurrent(posts, revs, "p1", "publish");
    expect(revs.all[0].snapshot).toBe(body("খসড়া"));
    expect(await snapshotCurrent(fakePosts({ status: "trashed", title: "", body: body("x"), excerpt: "" }), revs, "p1", "manual")).toBeNull();
    expect(await snapshotCurrent(fakePosts(null), revs, "p1", "manual")).toBeNull();
  });
});

describe("maybeIntervalSnapshot", () => {
  const kv = () => {
    const m = new Map<string, unknown>();
    return { get: async <T,>(k: string) => m.get(k) as T | undefined, set: async (k: string, v: unknown) => void m.set(k, v) };
  };
  it("১০ মিনিটে ≤১টা; খালি লেখা বাদ", async () => {
    const revs = fakeRevs();
    const store = kv();
    const get = async () => revs;
    const t0 = 1_000_000_000;
    expect(await maybeIntervalSnapshot(get, store, "p1", body(""), t0)).toBe(false);
    expect(await maybeIntervalSnapshot(get, store, "p1", body("এক"), t0)).toBe(true);
    expect(await maybeIntervalSnapshot(get, store, "p1", body("দুই"), t0 + 60_000)).toBe(false);
    expect(await maybeIntervalSnapshot(get, store, "p1", body("দুই"), t0 + REVISION_INTERVAL_MS)).toBe(true);
    expect(revs.all.map((x) => x.trigger)).toEqual(["interval", "interval"]);
  });
  it("snapshot ব্যর্থ হলে সময়-চিহ্ন বসে না (পরের sync-এ আবার চেষ্টা)", async () => {
    const revs = fakeRevs();
    const store = kv();
    revs.failNext = true;
    await expect(maybeIntervalSnapshot(async () => revs, store, "p1", body("এক"), 5)).rejects.toThrow();
    expect(await store.get("rev:p1")).toBeUndefined();
  });
});

describe("restoreRevision", () => {
  it("draft লেখা: আগে বর্তমানের snapshot, তারপর posts-এ body/wordCount/স্বয়ংক্রিয় সারাংশ", async () => {
    const revs = fakeRevs();
    const old = await revs.create({ targetId: "p1", snapshot: body("পুরনো লেখা"), trigger: "manual" });
    const posts = fakePosts({ status: "draft", title: "t", body: body("নতুন লেখা এখন"), excerpt: makeExcerpt("নতুন লেখা এখন") });
    const res = await restoreRevision(posts, revs, old.id);
    expect(res).toEqual({ kind: "restored", published: false });
    expect(revs.all.at(-1)!.snapshot).toBe(body("নতুন লেখা এখন")); // হারানো যায় না
    expect(posts.cur!.body).toBe(body("পুরনো লেখা"));
    expect(posts.cur!.excerpt).toBe(makeExcerpt("পুরনো লেখা"));
    expect(posts.calls).toEqual(["update:2"]);
  });
  it("প্রকাশিত লেখা: drafts-এ যায় (posts অক্ষত); হাতে-লেখা সারাংশ অক্ষত", async () => {
    const revs = fakeRevs();
    const old = await revs.create({ targetId: "p1", snapshot: body("পুরনো"), trigger: "publish" });
    const posts = fakePosts({ status: "published", title: "শিরোনাম", body: body("প্রকাশিত"), excerpt: "আমার সারাংশ" });
    const res = await restoreRevision(posts, revs, old.id);
    expect(res).toEqual({ kind: "restored", published: true });
    expect(posts.calls).toEqual(["saveEdit"]);
    expect(posts.cur!.body).toBe(body("প্রকাশিত"));
    expect(posts.cur!.draft).toEqual({ title: "শিরোনাম", body: body("পুরনো"), excerpt: "আমার সারাংশ" });
  });
  it("একই body ⇒ same (কিছু লেখে না); না থাকা/trashed ⇒ unavailable", async () => {
    const revs = fakeRevs();
    const r = await revs.create({ targetId: "p1", snapshot: body("এক"), trigger: "manual" });
    const posts = fakePosts({ status: "draft", title: "", body: body("এক"), excerpt: "" });
    expect(await restoreRevision(posts, revs, r.id)).toEqual({ kind: "same" });
    expect(posts.calls).toEqual([]);
    expect(await restoreRevision(posts, revs, "nope")).toEqual({ kind: "unavailable" });
    expect(await restoreRevision(fakePosts({ status: "trashed", title: "", body: body("অন্য"), excerpt: "" }), revs, r.id)).toEqual({ kind: "unavailable" });
  });
  it("বর্তমানের snapshot ব্যর্থ হলে restore হয় না", async () => {
    const revs = fakeRevs();
    const old = await revs.create({ targetId: "p1", snapshot: body("পুরনো"), trigger: "manual" });
    const posts = fakePosts({ status: "draft", title: "", body: body("নতুন"), excerpt: "" });
    revs.failNext = true;
    await expect(restoreRevision(posts, revs, old.id)).rejects.toThrow();
    expect(posts.calls).toEqual([]);
    expect(posts.cur!.body).toBe(body("নতুন"));
  });
});
