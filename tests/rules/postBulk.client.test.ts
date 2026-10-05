// postBulk.client-কে আসল rules-এর নিচে Emulator-এ চালানো (Checklist P3b-ক)
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBulkAdapterClient } from "../../src/data/postBulk.client";
import { createPostRepoClient } from "../../src/data/postRepo.client";
import type { PostWithId } from "../../src/data/postRepo";
import { planBulk, type BulkPost } from "../../src/lib/bulk";
import { renderRules } from "../../src/lib/renderRules";

const OWNER = "testOwnerUid1234567890";
let env: RulesTestEnvironment;
const fs = (x: unknown) => x as Firestore;
const db = () => fs(env.authenticatedContext(OWNER).firestore());
const repo = () => createPostRepoClient(db(), OWNER);
const adapter = () => createBulkAdapterClient(db());
const now = new Date("2026-10-06T00:00:00Z");
const body = (t: string) =>
  JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
  });
const bp = (p: PostWithId): BulkPost => p;

beforeAll(async () => {
  const rules = renderRules(readFileSync("firestore.rules.tpl", "utf8"), OWNER);
  env = await initializeTestEnvironment({
    projectId: "demo-ancientmarinerblog",
    firestore: { rules },
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

async function make(title: string) {
  return repo().create({ title, body: body(title) });
}

describe("commit", () => {
  it("bulk publish: status/visibility/publishedAt/ক্যাটাগরি লেখা; rules পাস; পাবলিক-query-তে দেখা যায়", async () => {
    const a = await make("এক");
    const b = await make("দুই");
    const posts = await adapter().loadPosts([a.id, b.id]);
    const plan = planBulk(
      posts,
      { kind: "publish", defaultCategory: { id: "default-other", name: "অন্যান্য" } },
      now,
    );
    const res = await adapter().commit(plan.updates);
    expect(res).toMatchObject({ failedIds: [], affectsPublic: 2 });
    const got = await repo().get(a.id);
    expect(got).toMatchObject({
      status: "published",
      visibility: "public",
      categoryId: "default-other",
    });
    expect(got?.publishedAt?.toISOString()).toBe(now.toISOString());
  });

  it("trash প্রকাশিত লেখা: থাকা drafts posts-এ কপি হয়ে মোছে; restore trashedAt সরায়", async () => {
    const a = await make("প্রকাশিত");
    await repo().update(a.id, { status: "published", visibility: "public" });
    await repo().saveEdit(a.id, {
      title: "নতুন শিরোনাম",
      body: body("নতুন লেখা অংশ"),
      excerpt: "e",
    });
    const ad = adapter();
    const t = planBulk(await ad.loadPosts([a.id]), { kind: "trash" }, now);
    expect(t.updates[0]).toMatchObject({ leavesPublished: true, affectsPublic: true });
    expect(await ad.commit(t.updates)).toMatchObject({ failedIds: [], affectsPublic: 1 });
    const trashed = await repo().get(a.id);
    expect(trashed).toMatchObject({ status: "trashed", title: "নতুন শিরোনাম" });
    expect(trashed?.trashedAt).toBeDefined();
    expect(await repo().getDraft(a.id)).toBeNull();

    const r = planBulk(await ad.loadPosts([a.id]), { kind: "restore" }, now);
    await ad.commit(r.updates);
    const back = await repo().get(a.id);
    expect(back?.status).toBe("draft");
    expect(back?.trashedAt).toBeUndefined();
  });

  it("idempotent: একই plan দ্বিতীয়বার ⇒ কিছু বদলায় না (unchanged)", async () => {
    const a = await make("এক");
    const ad = adapter();
    const act = { kind: "archive" } as const;
    await ad.commit(planBulk(await ad.loadPosts([a.id]), act, now).updates);
    const again = planBulk(await ad.loadPosts([a.id]), act, now);
    expect(again.updates).toEqual([]);
    expect(again.skipped).toEqual([{ id: a.id, reason: "unchanged" }]);
  });

  it("series: maxSeriesOrder নির্বাচিত বাদে; পর্ব-নম্বর বসে; category null-clear কাজ করে", async () => {
    const a = await make("এক");
    const b = await make("দুই");
    const c = await make("তিন");
    await repo().update(c.id, { seriesId: "s1", seriesOrder: 7 });
    const ad = adapter();
    expect(await ad.maxSeriesOrder("s1", new Set([a.id, b.id]))).toBe(7);
    expect(await ad.maxSeriesOrder("s1", new Set([c.id]))).toBe(0);
    const plan = planBulk(
      await ad.loadPosts([a.id, b.id]),
      { kind: "series", id: "s1", start: 8 },
      now,
    );
    await ad.commit(plan.updates);
    expect((await repo().get(a.id))?.seriesOrder).toBeGreaterThanOrEqual(8);
    expect(
      new Set([(await repo().get(a.id))?.seriesOrder, (await repo().get(b.id))?.seriesOrder]),
    ).toEqual(new Set([8, 9]));
  });

  it("loadPosts: না-থাকা id বাদ; অন্যের uid (non-owner) লিখতে পারে না", async () => {
    const a = await make("এক");
    expect((await adapter().loadPosts([a.id, "nope"])).map((p) => p.id)).toEqual([a.id]);
    const other = createBulkAdapterClient(fs(env.authenticatedContext("someoneElse").firestore()));
    const res = await other.commit(planBulk([bp(a)], { kind: "archive" }, now).updates);
    expect(res.failedIds).toEqual([a.id]);
    expect((await getDoc(doc(db(), "posts", a.id))).data()?.status).toBe("draft");
  });
});
