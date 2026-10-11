// projectRepo.client-কে আসল rules-এর নিচে Emulator-এ চালানো (Checklist P14a-১)
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ChapterNotFoundError, ProjectHasChaptersError, ProjectNotFoundError, ProjectRuleError } from "../../src/data/projectRepo";
import { createProjectRepoClient } from "../../src/data/projectRepo.client";
import { renderRules } from "../../src/lib/renderRules";

const OWNER = "testOwnerUid1234567890";
let env: RulesTestEnvironment;
const fs = (x: unknown) => x as Firestore;
const ownerDb = () => fs(env.authenticatedContext(OWNER).firestore());
const repo = () => createProjectRepoClient(ownerDb(), OWNER);

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

const newProject = (title = "প্রাচীন নাবিক", extra: Record<string, unknown> = {}) =>
  repo().createProject({ title, type: "novel", ...extra });

describe("projectRepo.client — প্রজেক্ট (Emulator)", () => {
  it("create: draft+private, বাংলা slug, ownerUid/schemaVersion; list/get মেলে", async () => {
    const p = await newProject("প্রাচীন নাবিক", { targetWords: 50000 });
    expect(p).toMatchObject({ slug: "প্রাচীন-নাবিক", status: "draft", visibility: "private", type: "novel", targetWords: 50000, ownerUid: OWNER, schemaVersion: 1 });
    expect((await repo().listProjects()).map((x) => x.id)).toEqual([p.id]);
    expect((await repo().getProject(p.id))?.title).toBe("প্রাচীন নাবিক");
  });

  it("একই id-তে দ্বিতীয় create idempotent (duplicate নয়)", async () => {
    const a = await repo().createProject({ id: "fixedProj0000000001", title: "এক", type: "story" });
    const b = await repo().createProject({ id: "fixedProj0000000001", title: "এক", type: "story" });
    expect(b.id).toBe(a.id);
    expect(await repo().listProjects()).toHaveLength(1);
  });

  it("slug সংঘাতে -২, -৩; শিরোনামহীন-চিহ্নে id-ভিত্তিক fallback", async () => {
    const a = await newProject("গল্প");
    const b = await newProject("গল্প");
    const c = await newProject("গল্প");
    expect([a.slug, b.slug, c.slug]).toEqual(["গল্প", "গল্প-২", "গল্প-৩"]);
    const d = await repo().createProject({ id: "SymbolId9999999999", title: "!!!", type: "drama" });
    expect(d.slug).toBe("project-symbolid");
  });

  it("update: প্রথম published-এ publishedAt বসে; slug অপরিবর্তিত; targetWords null = সরানো", async () => {
    const p = await newProject("নাম", { targetWords: 1000 });
    const u = await repo().updateProject(p.id, { title: "নতুন নাম", status: "published", visibility: "public", targetWords: null });
    expect(u.slug).toBe(p.slug);
    expect(u.title).toBe("নতুন নাম");
    expect(u.publishedAt).toBeInstanceOf(Date);
    expect(u.targetWords).toBeUndefined();
    const again = await repo().updateProject(p.id, { status: "draft" });
    expect(again.publishedAt?.getTime()).toBe(u.publishedAt?.getTime());
  });

  it("অবৈধ ইনপুটে Zod ব্যর্থ; অজানা id-তে ProjectNotFoundError", async () => {
    await expect(repo().createProject({ title: "  ", type: "novel" })).rejects.toThrow();
    await expect(repo().createProject({ title: "x", type: "poem" as never })).rejects.toThrow();
    await expect(repo().updateProject("nope1234567890123456", { title: "x" })).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("delete-guard: অধ্যায় (ট্র্যাশ সহ) থাকলে মোছা যায় না; সব সরলে যায়; দ্বিতীয়বারও সফল", async () => {
    const p = await newProject();
    const c = await repo().createChapter({ projectId: p.id, title: "এক" });
    await expect(repo().deleteProject(p.id)).rejects.toBeInstanceOf(ProjectHasChaptersError);
    await repo().trashChapter(c.id);
    await expect(repo().deleteProject(p.id)).rejects.toMatchObject({ count: 1 });
    await repo().deleteChapter(c.id);
    await repo().deleteProject(p.id);
    await repo().deleteProject(p.id);
    expect(await repo().getProject(p.id)).toBeNull();
  });
});

describe("projectRepo.client — অধ্যায় (Emulator)", () => {
  it("create: draft+private, order ০,১,২…, slug প্রজেক্টের ভেতরে অনন্য; অন্য প্রজেক্টে একই slug চলে", async () => {
    const p = await newProject();
    const q = await newProject("অন্য");
    const a = await repo().createChapter({ projectId: p.id, title: "অধ্যায়", body: "{}", wordCount: 10 });
    const b = await repo().createChapter({ projectId: p.id, title: "অধ্যায়" });
    const x = await repo().createChapter({ projectId: q.id, title: "অধ্যায়" });
    expect([a.order, b.order, x.order]).toEqual([0, 1, 0]);
    expect([a.slug, b.slug, x.slug]).toEqual(["অধ্যায়", "অধ্যায়-২", "অধ্যায়"]);
    expect(a).toMatchObject({ status: "draft", visibility: "private", wordCount: 10, ownerUid: OWNER, schemaVersion: 1 });
    expect((await repo().listChapters(p.id)).map((c) => c.id)).toEqual([a.id, b.id]);
  });

  it("একই id-তে দ্বিতীয় create idempotent; অজানা প্রজেক্টে ProjectNotFoundError", async () => {
    const p = await newProject();
    const a = await repo().createChapter({ id: "fixedChap000000001", projectId: p.id, title: "এক" });
    const b = await repo().createChapter({ id: "fixedChap000000001", projectId: p.id, title: "এক" });
    expect(b.id).toBe(a.id);
    expect(await repo().listChapters(p.id)).toHaveLength(1);
    await expect(repo().createChapter({ projectId: "noProject00000000001", title: "x" })).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("update: body/wordCount/status/visibility; slug-projectId-order অপরিবর্তিত; প্রথম প্রকাশে publishedAt", async () => {
    const p = await newProject();
    const c = await repo().createChapter({ projectId: p.id, title: "এক" });
    const u = await repo().updateChapter(c.id, { title: "এক (সংশোধিত)", body: "{\"a\":1}", wordCount: 42, status: "published", visibility: "public" });
    expect(u).toMatchObject({ slug: c.slug, projectId: p.id, order: c.order, wordCount: 42, status: "published", visibility: "public" });
    expect(u.publishedAt).toBeInstanceOf(Date);
    await expect(repo().updateChapter(c.id, { status: "trashed" as never })).rejects.toBeInstanceOf(ProjectRuleError);
    await expect(repo().updateChapter("nope1234567890123456", { title: "x" })).rejects.toBeInstanceOf(ChapterNotFoundError);
  });

  it("reorder: পাশাপাশি অদলবদলে ঠিক ২ অধ্যায়ের order বদলায়; আবার চালালে বদল নেই (idempotent)", async () => {
    const p = await newProject();
    const [a, b, c] = [
      await repo().createChapter({ projectId: p.id, title: "ক" }),
      await repo().createChapter({ projectId: p.id, title: "খ" }),
      await repo().createChapter({ projectId: p.id, title: "গ" }),
    ];
    const r1 = await repo().reorderChapters(p.id, [b.id, a.id, c.id]);
    expect(r1.map((x) => [x.id, x.order])).toEqual([[b.id, 0], [a.id, 1], [c.id, 2]]);
    const before = (await repo().getChapter(c.id))?.updatedAt.getTime();
    await repo().reorderChapters(p.id, [b.id, a.id, c.id]);
    expect((await repo().getChapter(c.id))?.updatedAt.getTime()).toBe(before); // c ছোঁয়াই হয়নি
    expect((await repo().listChapters(p.id)).map((x) => x.id)).toEqual([b.id, a.id, c.id]);
  });

  it("reorder: permutation না হলে ProjectRuleError (কিছু লেখা হয় না)", async () => {
    const p = await newProject();
    const a = await repo().createChapter({ projectId: p.id, title: "ক" });
    const b = await repo().createChapter({ projectId: p.id, title: "খ" });
    await expect(repo().reorderChapters(p.id, [a.id])).rejects.toBeInstanceOf(ProjectRuleError);
    await expect(repo().reorderChapters(p.id, [a.id, a.id])).rejects.toBeInstanceOf(ProjectRuleError);
    expect((await repo().listChapters(p.id)).map((x) => x.id)).toEqual([a.id, b.id]);
  });

  it("reorder: ট্র্যাশ-করা অধ্যায় বাদ থাকে; ট্র্যাশ তালিকায় আসে না, includeTrashed-এ আসে", async () => {
    const p = await newProject();
    const a = await repo().createChapter({ projectId: p.id, title: "ক" });
    const b = await repo().createChapter({ projectId: p.id, title: "খ" });
    const c = await repo().createChapter({ projectId: p.id, title: "গ" });
    await repo().trashChapter(b.id);
    expect((await repo().listChapters(p.id)).map((x) => x.id)).toEqual([a.id, c.id]);
    expect((await repo().listChapters(p.id, { includeTrashed: true })).map((x) => x.id)).toEqual([a.id, b.id, c.id]);
    const r = await repo().reorderChapters(p.id, [c.id, a.id]);
    expect(r.map((x) => x.id)).toEqual([c.id, a.id]);
    await expect(repo().reorderChapters(p.id, [c.id, a.id, b.id])).rejects.toBeInstanceOf(ProjectRuleError); // ট্র্যাশ-করা সেটে নেই
  });

  it("trash/restore: trashedAt বসে-মোছে; restore = draft (republish নয়); idempotent; ট্র্যাশে update নিষিদ্ধ", async () => {
    const p = await newProject();
    const c = await repo().createChapter({ projectId: p.id, title: "এক" });
    await repo().updateChapter(c.id, { status: "published", visibility: "public" });
    const t = await repo().trashChapter(c.id);
    expect(t.status).toBe("trashed");
    expect(t.trashedAt).toBeInstanceOf(Date);
    expect((await repo().trashChapter(c.id)).trashedAt?.getTime()).toBe(t.trashedAt?.getTime());
    await expect(repo().updateChapter(c.id, { title: "x" })).rejects.toBeInstanceOf(ProjectRuleError);
    const r = await repo().restoreChapter(c.id);
    expect(r.status).toBe("draft");
    expect(r.trashedAt).toBeUndefined();
    expect((await repo().restoreChapter(c.id)).status).toBe("draft");
  });

  it("deleteChapter: শুধু ট্র্যাশ-করা; live অধ্যায়ে ProjectRuleError ও doc অক্ষত; না থাকলেও সফল", async () => {
    const p = await newProject();
    const c = await repo().createChapter({ projectId: p.id, title: "এক" });
    await expect(repo().deleteChapter(c.id)).rejects.toBeInstanceOf(ProjectRuleError);
    expect(await repo().getChapter(c.id)).not.toBeNull();
    await repo().trashChapter(c.id);
    await repo().deleteChapter(c.id);
    await repo().deleteChapter(c.id);
    expect(await repo().getChapter(c.id)).toBeNull();
  });

  it("পরিধি-নিরাপত্তা: একটা বিকৃত অধ্যায়-doc পুরো তালিকা ভাঙে না; slug/order-সংঘাত ও সংখ্যা তবু গণ্য", async () => {
    const p = await newProject();
    const a = await repo().createChapter({ projectId: p.id, title: "ক" });
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { setDoc } = await import("firebase/firestore");
      await setDoc(doc(fs(ctx.firestore()), "chapters", "broken00000000000001"), { projectId: p.id, slug: "খ", order: 5, status: "draft" }); // title ইত্যাদি নেই
    });
    expect((await repo().listChapters(p.id)).map((x) => x.id)).toEqual([a.id]);
    const b = await repo().createChapter({ projectId: p.id, title: "খ" });
    expect(b.slug).toBe("খ-২"); // বিকৃত doc-এর slug এড়ানো
    expect(b.order).toBe(6); // বিকৃত doc-এর order-এর পরে
  });

  it("rules-বাধা: client সরাসরি projectId বদলাতে পারে না", async () => {
    const p = await newProject();
    const c = await repo().createChapter({ projectId: p.id, title: "এক" });
    await expect(updateDoc(doc(ownerDb(), "chapters", c.id), { projectId: "otherProj0000000001" })).rejects.toThrow();
    expect((await getDoc(doc(ownerDb(), "chapters", c.id))).data()?.projectId).toBe(p.id);
  });
});

// P14a-৩: প্রকাশিত অধ্যায়ের সম্পাদনা `drafts`-এ; প্রকাশ/বাতিল/ট্র্যাশ/unpublish-এ কিছু হারায় না
describe("projectRepo.client — অধ্যায়ের drafts (Emulator, P14a-৩)", () => {
  const published = async () => {
    const p = await newProject();
    const c = await repo().createChapter({ projectId: p.id, title: "এক", body: "{\"v\":1}", wordCount: 1 });
    await repo().updateChapter(c.id, { status: "published" });
    return c;
  };
  const draftDoc = (id: string) => getDoc(doc(ownerDb(), "drafts", id));

  it("saveChapterEdit: drafts-এ targetType='chapter'; অধ্যায়-doc অপরিবর্তিত; idempotent; draft-অধ্যায়ে নিষিদ্ধ", async () => {
    const c = await published();
    await repo().saveChapterEdit(c.id, { title: "এক-নতুন", body: "{\"v\":2}", wordCount: 2 });
    await repo().saveChapterEdit(c.id, { title: "এক-নতুন", body: "{\"v\":2}", wordCount: 2 });
    const d = await repo().getChapterDraft(c.id);
    expect(d).toMatchObject({ targetType: "chapter", title: "এক-নতুন", body: "{\"v\":2}", wordCount: 2, ownerUid: OWNER });
    expect(await repo().getChapter(c.id)).toMatchObject({ title: "এক", body: "{\"v\":1}", wordCount: 1 });
    const q = await repo().createChapter({ projectId: c.projectId, title: "খসড়া" });
    await expect(repo().saveChapterEdit(q.id, { title: "x", body: "", wordCount: 0 })).rejects.toBeInstanceOf(ProjectRuleError);
  });

  it("applyChapterDraft: drafts → chapters এক batch-এ, draft মোছে; draft না থাকলে null", async () => {
    const c = await published();
    expect(await repo().applyChapterDraft(c.id)).toBeNull();
    await repo().saveChapterEdit(c.id, { title: "এক-নতুন", body: "{\"v\":2}", wordCount: 2 });
    const u = await repo().applyChapterDraft(c.id);
    expect(u).toMatchObject({ title: "এক-নতুন", body: "{\"v\":2}", wordCount: 2, status: "published", slug: c.slug, order: c.order });
    expect((await draftDoc(c.id)).exists()).toBe(false);
  });

  it("discardChapterDraft: অধ্যায় অক্ষত, draft নেই; না থাকলেও সফল", async () => {
    const c = await published();
    await repo().saveChapterEdit(c.id, { title: "বাতিল হবে", body: "{}", wordCount: 0 });
    await repo().discardChapterDraft(c.id);
    await repo().discardChapterDraft(c.id);
    expect(await repo().getChapterDraft(c.id)).toBeNull();
    expect((await repo().getChapter(c.id))?.title).toBe("এক");
  });

  it("trash: থাকা draft আগে অধ্যায়ে মেশে (লুকানো সম্পাদনা হারায় না); drafts মোছে", async () => {
    const c = await published();
    await repo().saveChapterEdit(c.id, { title: "এক-নতুন", body: "{\"v\":2}", wordCount: 2 });
    const t = await repo().trashChapter(c.id);
    expect(t).toMatchObject({ status: "trashed", title: "এক-নতুন", body: "{\"v\":2}", wordCount: 2 });
    expect((await draftDoc(c.id)).exists()).toBe(false);
  });

  it("প্রকাশিত → draft: থাকা সম্পাদনা অধ্যায়ে মেশে; শুধু visibility বদলালে draft থাকে", async () => {
    const c = await published();
    await repo().saveChapterEdit(c.id, { title: "এক-নতুন", body: "{\"v\":2}", wordCount: 2 });
    await repo().updateChapter(c.id, { visibility: "private" });
    expect(await repo().getChapterDraft(c.id)).not.toBeNull();
    const u = await repo().updateChapter(c.id, { status: "draft" });
    expect(u).toMatchObject({ status: "draft", title: "এক-নতুন", body: "{\"v\":2}" });
    expect((await draftDoc(c.id)).exists()).toBe(false);
  });

  it("স্থায়ী মোছা: পড়ে-থাকা draft-ও যায়", async () => {
    const c = await published();
    await repo().trashChapter(c.id);
    await setDoc(doc(ownerDb(), "drafts", c.id), { targetType: "chapter", title: "stray", body: "{}", wordCount: 0, ownerUid: OWNER, updatedAt: new Date() });
    await repo().deleteChapter(c.id);
    expect((await draftDoc(c.id)).exists()).toBe(false);
    expect(await repo().getChapter(c.id)).toBeNull();
  });

  it("post-ধরনের draft অধ্যায়ের draft হিসেবে পড়া হয় না", async () => {
    const c = await published();
    await setDoc(doc(ownerDb(), "drafts", c.id), { targetType: "post", title: "p", body: "{}", excerpt: "", ownerUid: OWNER, updatedAt: new Date() });
    expect(await repo().getChapterDraft(c.id)).toBeNull();
  });
});
