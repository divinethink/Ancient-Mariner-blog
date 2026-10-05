// ideaRepo.client / noteRepo.client-কে আসল rules-এর নিচে Emulator-এ চালানো (Checklist P3b)
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import type { Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { IdeaNotFoundError } from "../../src/data/ideaRepo";
import { createIdeaRepoClient } from "../../src/data/ideaRepo.client";
import { createNoteRepoClient } from "../../src/data/noteRepo.client";
import { renderRules } from "../../src/lib/renderRules";

const OWNER = "testOwnerUid1234567890";
let env: RulesTestEnvironment;
const fs = (x: unknown) => x as Firestore;
const ownerDb = () => fs(env.authenticatedContext(OWNER).firestore());
const ideas = () => createIdeaRepoClient(ownerDb(), OWNER);
const notes = () => createNoteRepoClient(ownerDb(), OWNER);

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

describe("ideaRepo.client (Emulator)", () => {
  it("create → get/list; ownerUid/type/schemaVersion বসে", async () => {
    const a = await ideas().create({ text: "রাতের আকাশে জোনাকি" });
    expect(a.type).toBe("quick");
    expect(a.ownerUid).toBe(OWNER);
    expect(a.schemaVersion).toBe(1);
    expect((await ideas().list()).map((x) => x.id)).toEqual([a.id]);
    expect((await ideas().get(a.id))?.text).toBe("রাতের আকাশে জোনাকি");
  });

  it("একই id-তে দ্বিতীয় create idempotent (duplicate নয়, লেখা অপরিবর্তিত)", async () => {
    const a = await ideas().create({ id: "ideaFixed0000000001", text: "প্রথম" });
    const b = await ideas().create({ id: "ideaFixed0000000001", text: "দ্বিতীয়" });
    expect(b.id).toBe(a.id);
    expect(b.text).toBe("প্রথম");
    expect(await ideas().list()).toHaveLength(1);
  });

  it("খালি/সীমা-ছাড়ানো লেখা প্রত্যাখ্যাত", async () => {
    await expect(ideas().create({ text: "   " })).rejects.toThrow();
    await expect(ideas().create({ text: "ক".repeat(2001) })).rejects.toThrow();
    expect(await ideas().list()).toHaveLength(0);
  });

  it("update: শিরোনাম বসানো/null-এ সরানো, type বদল; না-থাকা idea-তে IdeaNotFoundError", async () => {
    const a = await ideas().create({ text: "ধারণা" });
    const withTitle = await ideas().update(a.id, { title: "শিরোনাম", type: "concept" });
    expect(withTitle.title).toBe("শিরোনাম");
    expect(withTitle.type).toBe("concept");
    const cleared = await ideas().update(a.id, { title: null });
    expect(cleared.title).toBeUndefined();
    await expect(ideas().update("nope", { text: "x" })).rejects.toBeInstanceOf(IdeaNotFoundError);
  });

  it("markConverted idempotent; delete না-থাকলেও সফল", async () => {
    const a = await ideas().create({ text: "আইডিয়া" });
    const m1 = await ideas().markConverted(a.id, "post1");
    const m2 = await ideas().markConverted(a.id, "post1");
    expect(m1.convertedToPostId).toBe("post1");
    expect(m2.updatedAt.getTime()).toBe(m1.updatedAt.getTime());
    await ideas().delete(a.id);
    await ideas().delete(a.id);
    expect(await ideas().get(a.id)).toBeNull();
  });
});

describe("noteRepo.client (Emulator)", () => {
  it("create → Inbox-এ আসে (organized=false); একই id-তে দ্বিতীয় create duplicate নয়", async () => {
    const a = await notes().create({ id: "noteFixed0000000001", content: "ফোনে পাওয়া নোট" });
    await notes().create({ id: "noteFixed0000000001", content: "অন্য" });
    expect(a.organized).toBe(false);
    expect(a.kind).toBe("note");
    const inbox = await notes().list({ organized: false });
    expect(inbox.map((n) => n.id)).toEqual([a.id]);
    expect(inbox[0].content).toBe("ফোনে পাওয়া নোট");
  });

  it("setOrganized: Inbox থেকে সরে 'সাজানো'-তে যায়, ফেরানো যায়; idempotent", async () => {
    const a = await notes().create({ content: "নোট" });
    await notes().setOrganized(a.id, true);
    await notes().setOrganized(a.id, true);
    expect(await notes().list({ organized: false })).toHaveLength(0);
    expect((await notes().list({ organized: true })).map((n) => n.id)).toEqual([a.id]);
    await notes().setOrganized(a.id, false);
    expect(await notes().list({ organized: false })).toHaveLength(1);
  });

  it("delete; খালি নোট প্রত্যাখ্যাত", async () => {
    const a = await notes().create({ content: "মুছব" });
    await notes().delete(a.id);
    expect(await notes().list({ organized: false })).toHaveLength(0);
    await expect(notes().create({ content: "  " })).rejects.toThrow();
  });
});
