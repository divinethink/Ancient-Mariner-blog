// postRepo.client-কে আসল rules-এর নিচে Emulator-এ চালানো (Checklist P2a-১)
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPostRepoClient } from "../../src/data/postRepo.client";
import { PostNotFoundError, SlugTakenError, TrashRequiredError } from "../../src/data/postRepo";
import { renderRules } from "../../src/lib/renderRules";

const OWNER = "testOwnerUid1234567890";
let env: RulesTestEnvironment;
// rules-unit-testing-এর টাইপ compat হতে পারে; রানটাইমে modular ফাংশন চলে — তাই cast
const fs = (x: unknown) => x as Firestore;
const db = () => fs(env.authenticatedContext(OWNER).firestore());
const repo = () => createPostRepoClient(db(), OWNER);
const input = (o: Record<string, unknown> = {}) => ({ title: "আমার লেখা", body: "{}", ...o });

beforeAll(async () => {
  const rules = renderRules(readFileSync("firestore.rules.tpl", "utf8"), OWNER);
  env = await initializeTestEnvironment({ projectId: "demo-ancientmarinerblog", firestore: { rules } });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

describe("create", () => {
  it("post ও slug-lock একসাথে তৈরি; বাংলা slug; draft+private", async () => {
    const p = await repo().create(input());
    expect(p.slug).toBe("আমার-লেখা");
    expect(p.status).toBe("draft");
    expect(p.visibility).toBe("private");
    expect((await getDoc(doc(db(), "slugs", "আমার-লেখা"))).data()?.postId).toBe(p.id);
    expect(await repo().get(p.id)).toMatchObject({ title: "আমার লেখা", slug: "আমার-লেখা" });
  });
  it("একই শিরোনামে সংঘাত → suffix (-২, -৩)", async () => {
    const a = await repo().create(input());
    const b = await repo().create(input());
    const c = await repo().create(input());
    expect([a.slug, b.slug, c.slug]).toEqual(["আমার-লেখা", "আমার-লেখা-২", "আমার-লেখা-৩"]);
  });
  it("স্পষ্ট slug সংঘাতে SlugTakenError (suffix নয়)", async () => {
    await repo().create(input({ slug: "my-slug" }));
    await expect(repo().create(input({ slug: "my-slug" }))).rejects.toBeInstanceOf(SlugTakenError);
  });
  it("শিরোনাম খালি → fallback slug", async () => {
    const p = await repo().create(input({ title: "" }));
    expect(p.slug).toMatch(/^post-/);
  });
  it("idempotent: একই id-তে দ্বিতীয় create বিদ্যমান ফেরত, সম্পাদনা মোছে না", async () => {
    const a = await repo().create(input({ id: "fixed1" }));
    await repo().update(a.id, { title: "বদলানো" });
    const again = await repo().create(input({ id: "fixed1" }));
    expect(again.title).toBe("বদলানো");
    expect(again.slug).toBe(a.slug);
  });
  it("retry-নিরাপদ: lock আছে কিন্তু post নেই (আংশিক অবস্থা) → নিজের lock পুনর্ব্যবহার", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(fs(ctx.firestore()), "slugs", "আমার-লেখা"), { postId: "fixed2" });
    });
    const p = await repo().create(input({ id: "fixed2" }));
    expect(p.slug).toBe("আমার-লেখা");
  });
});

describe("update", () => {
  it("প্রথম প্রকাশে publishedAt বসে; পরের আপডেটে বদলায় না", async () => {
    const p = await repo().create(input());
    await repo().update(p.id, { status: "published", visibility: "public" });
    const a = await repo().get(p.id);
    expect(a?.publishedAt).toBeInstanceOf(Date);
    await new Promise((r) => setTimeout(r, 20));
    await repo().update(p.id, { status: "published", title: "নতুন" });
    const b = await repo().get(p.id);
    expect(b?.publishedAt?.getTime()).toBe(a?.publishedAt?.getTime());
    expect(b?.title).toBe("নতুন");
  });
  it("অবৈধ patch Zod-এ আটকায়", async () => {
    const p = await repo().create(input());
    await expect(repo().update(p.id, { status: "bogus" as never })).rejects.toThrow();
  });
  it("অস্তিত্বহীন post প্রকাশে PostNotFoundError", async () => {
    await expect(repo().update("nope", { status: "published" })).rejects.toBeInstanceOf(PostNotFoundError);
  });
});

describe("changeSlug", () => {
  it("নতুন lock + পুরনো slug history-তে; পুরনো lock থাকে (reserved)", async () => {
    const p = await repo().create(input());
    const r = await repo().changeSlug(p.id, "New Slug!");
    expect(r.slug).toBe("new-slug");
    expect(r.slugHistory).toEqual(["আমার-লেখা"]);
    expect((await getDoc(doc(db(), "slugs", "আমার-লেখা"))).exists()).toBe(true);
    expect((await getDoc(doc(db(), "slugs", "new-slug"))).data()?.postId).toBe(p.id);
    expect((await repo().get(p.id))?.slugHistory).toEqual(["আমার-লেখা"]);
  });
  it("অন্য লেখার slug নিলে SlugTakenError; কিছু বদলায় না", async () => {
    const a = await repo().create(input({ slug: "aaa" }));
    const b = await repo().create(input({ slug: "bbb" }));
    await expect(repo().changeSlug(b.id, "aaa")).rejects.toBeInstanceOf(SlugTakenError);
    expect((await repo().get(b.id))?.slug).toBe("bbb");
    expect((await repo().get(a.id))?.slug).toBe("aaa");
  });
  it("পুরনো নিজের slug-এ ফেরা চলে (lock নিজের); history থেকে বাদ", async () => {
    const p = await repo().create(input({ slug: "one" }));
    await repo().changeSlug(p.id, "two");
    const back = await repo().changeSlug(p.id, "one");
    expect(back.slug).toBe("one");
    expect(back.slugHistory).toEqual(["two"]);
  });
  it("একই slug দিলে no-op", async () => {
    const p = await repo().create(input({ slug: "same" }));
    expect((await repo().changeSlug(p.id, "same")).slugHistory).toEqual([]);
  });
});

describe("drafts (প্রকাশিত লেখার সম্পাদনা)", () => {
  it("saveEdit পাবলিক post বদলায় না; applyDraft কপি+মোছা; discard মোছে", async () => {
    const p = await repo().create(input({ body: "পুরনো" }));
    await repo().update(p.id, { status: "published", visibility: "public" });
    await repo().saveEdit(p.id, { title: "সম্পাদিত", body: "নতুন", excerpt: "সার" });
    await repo().saveEdit(p.id, { title: "সম্পাদিত-২", body: "নতুন-২", excerpt: "সার" }); // idempotent set
    expect((await repo().get(p.id))?.body).toBe("পুরনো");
    expect((await repo().getDraft(p.id))?.title).toBe("সম্পাদিত-২");

    expect(await repo().applyDraft(p.id, 7)).toBeInstanceOf(Date);
    const after = await repo().get(p.id);
    expect(after).toMatchObject({ title: "সম্পাদিত-২", body: "নতুন-২", excerpt: "সার", wordCount: 7 });
    expect(await repo().getDraft(p.id)).toBeNull();
    expect(await repo().applyDraft(p.id, 7)).toBeNull();

    await repo().saveEdit(p.id, { title: "x", body: "y", excerpt: "" });
    await repo().discardDraft(p.id);
    expect(await repo().getDraft(p.id)).toBeNull();
    expect((await repo().get(p.id))?.title).toBe("সম্পাদিত-২");
  });
});

describe("trash", () => {
  const slugExists = async (s: string) => (await getDoc(doc(db(), "slugs", s))).exists();

  it("trash → status/trashedAt; slug-lock অক্ষত; listTrashed-এ আসে; idempotent", async () => {
    const p = await repo().create(input());
    await repo().trash(p.id);
    const t = await repo().get(p.id);
    expect(t?.status).toBe("trashed");
    expect(t?.trashedAt).toBeInstanceOf(Date);
    expect(await slugExists(p.slug)).toBe(true);
    expect((await repo().listTrashed()).map((x) => x.id)).toEqual([p.id]);
    await repo().trash(p.id); // দ্বিতীয়বার কিছু বদলায় না
    expect((await repo().get(p.id))?.trashedAt?.getTime()).toBe(t?.trashedAt?.getTime());
  });

  it("প্রকাশিত লেখার drafts আগে posts-এ কপি হয়ে মোছে", async () => {
    const p = await repo().create(input({ body: "পুরনো" }));
    await repo().update(p.id, { status: "published", visibility: "public" });
    await repo().saveEdit(p.id, { title: "সম্পাদিত", body: "নতুন", excerpt: "সার" });
    await repo().trash(p.id);
    expect(await repo().getDraft(p.id)).toBeNull();
    expect(await repo().get(p.id)).toMatchObject({ status: "trashed", title: "সম্পাদিত", body: "নতুন" });
  });

  it("restore → draft, trashedAt যায়, slug একই; trashed না হলে no-op", async () => {
    const p = await repo().create(input());
    await repo().restore(p.id); // no-op
    expect((await repo().get(p.id))?.status).toBe("draft");
    await repo().trash(p.id);
    await repo().restore(p.id);
    const r = await repo().get(p.id);
    expect(r?.status).toBe("draft");
    expect(r?.trashedAt).toBeUndefined();
    expect(r?.slug).toBe(p.slug);
    expect(await repo().listTrashed()).toHaveLength(0);
  });

  it("deletePermanently: trashed না হলে TrashRequiredError, কিছু মোছে না", async () => {
    const p = await repo().create(input());
    await expect(repo().deletePermanently(p.id)).rejects.toBeInstanceOf(TrashRequiredError);
    expect(await repo().get(p.id)).not.toBeNull();
  });

  it("deletePermanently: post + বর্তমান ও পুরনো slug-lock + drafts একসাথে; retry-নিরাপদ", async () => {
    const p = await repo().create(input({ slug: "old-one" }));
    await repo().changeSlug(p.id, "new-one");
    await repo().saveEdit(p.id, { title: "x", body: "y", excerpt: "" });
    await repo().trash(p.id); // draft কপি হয়ে মোছে
    await repo().saveEdit(p.id, { title: "z", body: "w", excerpt: "" }); // পড়ে-থাকা draft
    await repo().deletePermanently(p.id);
    expect(await repo().get(p.id)).toBeNull();
    expect(await repo().getDraft(p.id)).toBeNull();
    expect(await slugExists("old-one")).toBe(false);
    expect(await slugExists("new-one")).toBe(false);
    await repo().deletePermanently(p.id); // আবার — ব্যর্থ নয়
  });

  it("deletePermanently অন্য লেখার slug-lock ছোঁয় না", async () => {
    const a = await repo().create(input({ slug: "a-slug" }));
    const b = await repo().create(input({ slug: "b-slug" }));
    await repo().trash(a.id);
    await repo().deletePermanently(a.id);
    expect(await slugExists("a-slug")).toBe(false);
    expect(await slugExists("b-slug")).toBe(true);
    expect(await repo().get(b.id)).not.toBeNull();
  });

  it("emptyTrash শুধু trashed মোছে", async () => {
    const keep = await repo().create(input({ title: "রাখব" }));
    const x = await repo().create(input({ title: "এক" }));
    const y = await repo().create(input({ title: "দুই" }));
    await repo().trash(x.id);
    await repo().trash(y.id);
    expect(await repo().emptyTrash()).toEqual({ deleted: 2, failed: 0 });
    expect((await repo().list()).map((p) => p.id)).toEqual([keep.id]);
  });

  it("অন্য uid trash/restore/মোছা পারে না", async () => {
    const p = await repo().create(input());
    await repo().trash(p.id);
    const intruder = createPostRepoClient(
      fs(env.authenticatedContext("intruder1234567").firestore()),
      "intruder1234567",
    );
    await expect(intruder.restore(p.id)).rejects.toThrow();
    await expect(intruder.deletePermanently(p.id)).rejects.toThrow();
    expect(await repo().get(p.id)).not.toBeNull();
  });
});

describe("list", () => {
  it("সর্বশেষ সম্পাদনা আগে; limit মানে", async () => {
    const a = await repo().create(input({ title: "এক" }));
    await new Promise((r) => setTimeout(r, 15));
    const b = await repo().create(input({ title: "দুই" }));
    await new Promise((r) => setTimeout(r, 15));
    await repo().update(a.id, { title: "এক-সম্পাদিত" });
    expect((await repo().list()).map((p) => p.id)).toEqual([a.id, b.id]);
    expect(await repo().list({ limit: 1 })).toHaveLength(1);
  });
});

describe("rules-এর নিচে", () => {
  it("অন্য uid-র repo কিছু লিখতে পারে না", async () => {
    const intruder = createPostRepoClient(
      fs(env.authenticatedContext("intruder1234567").firestore()),
      "intruder1234567",
    );
    await expect(intruder.create(input())).rejects.toThrow();
  });
});
