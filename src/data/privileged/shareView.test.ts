import { describe, expect, it } from "vitest";
import { hashShareToken } from "../shareToken";
import { resolveShare } from "./shareView";
import type { AdminDb, QueryDoc } from "./firestoreAdmin";

const NOW = Date.UTC(2026, 9, 10, 12, 0);
const TOKEN = "A".repeat(43);
const link = (extra: Record<string, unknown> = {}): QueryDoc => ({
  id: "h",
  data: { postId: "p1", ownerUid: "u", createdAt: new Date(NOW - 1000), expiresAt: new Date(NOW + 86_400_000), ...extra },
});
const mk = (docs: { shareLinks?: QueryDoc; posts?: QueryDoc; drafts?: QueryDoc }) => {
  const calls: [string, readonly string[]][] = [];
  const db = {
    async batchGet(c: string, ids: readonly string[]) {
      calls.push([c, ids]);
      const d = docs[c as keyof typeof docs];
      return { found: d ? [d] : [], missing: d ? [] : [...ids] };
    },
  } as unknown as AdminDb;
  return { db, calls };
};
const post = (extra: Record<string, unknown> = {}): QueryDoc => ({ id: "p1", data: { title: "শিরোনাম", body: '{"type":"doc"}', status: "draft", ...extra } });

describe("resolveShare", () => {
  it("অবৈধ token-এ কোনো DB-কল নেই", async () => {
    const { db, calls } = mk({});
    expect(await resolveShare(db, "short", NOW)).toEqual({ kind: "gone" });
    expect(calls).toEqual([]);
  });
  it("hash দিয়ে খোঁজে (token নিজে নয়); সক্রিয় লিংকে draft লেখা দেখায়", async () => {
    const { db, calls } = mk({ shareLinks: link(), posts: post() });
    const r = await resolveShare(db, TOKEN, NOW);
    expect(r).toMatchObject({ kind: "ok", title: "শিরোনাম", body: '{"type":"doc"}' });
    expect(calls[0]).toEqual(["shareLinks", [await hashShareToken(TOKEN)]]);
    expect(JSON.stringify(calls)).not.toContain(TOKEN);
  });
  it("লিংক নেই/revoked/মেয়াদ-শেষ = gone", async () => {
    expect(await resolveShare(mk({ posts: post() }).db, TOKEN, NOW)).toEqual({ kind: "gone" });
    expect(await resolveShare(mk({ shareLinks: link({ revokedAt: new Date(NOW - 5) }), posts: post() }).db, TOKEN, NOW)).toEqual({ kind: "gone" });
    expect(await resolveShare(mk({ shareLinks: link({ expiresAt: new Date(NOW - 1) }), posts: post() }).db, TOKEN, NOW)).toEqual({ kind: "gone" });
  });
  it("লেখা নেই/trashed/বিকৃত লিংক = gone", async () => {
    expect(await resolveShare(mk({ shareLinks: link() }).db, TOKEN, NOW)).toEqual({ kind: "gone" });
    expect(await resolveShare(mk({ shareLinks: link(), posts: post({ status: "trashed" }) }).db, TOKEN, NOW)).toEqual({ kind: "gone" });
    expect(await resolveShare(mk({ shareLinks: link({ expiresAt: "x" }), posts: post() }).db, TOKEN, NOW)).toEqual({ kind: "gone" });
  });
  it("অপ্রকাশিত সম্পাদনা (drafts) থাকলে সেটাই", async () => {
    const r = await resolveShare(mk({ shareLinks: link(), posts: post({ status: "published" }), drafts: { id: "p1", data: { title: "নতুন", body: '{"x":1}' } } }).db, TOKEN, NOW);
    expect(r).toMatchObject({ kind: "ok", title: "নতুন", body: '{"x":1}' });
  });
});
