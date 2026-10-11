import { describe, expect, it } from "vitest";
import { createPublicWorksSource } from "./worksRepo.server";

const T = { timestampValue: "2026-10-01T00:00:00Z" };
const proj = (id: string, f: Record<string, unknown> = {}) => ({
  document: {
    name: `projects/p/databases/(default)/documents/writingProjects/${id}`,
    fields: { title: { stringValue: "প্রাচীন নাবিক" }, slug: { stringValue: id }, type: { stringValue: "novel" }, status: { stringValue: "published" }, visibility: { stringValue: "public" }, ownerUid: { stringValue: "u" }, createdAt: T, updatedAt: T, ...f },
  },
});
const chap = (id: string, projectId: string, f: Record<string, unknown> = {}) => ({
  document: {
    name: `projects/p/databases/(default)/documents/chapters/${id}`,
    fields: { projectId: { stringValue: projectId }, title: { stringValue: "অধ্যায়" }, slug: { stringValue: id }, body: { stringValue: "{}" }, order: { integerValue: "0" }, status: { stringValue: "published" }, visibility: { stringValue: "public" }, ownerUid: { stringValue: "u" }, createdAt: T, updatedAt: T, ...f },
  },
});

function src(byCollection: Record<string, unknown[]>, bodies: string[] = []) {
  return createPublicWorksSource({
    projectId: "p",
    apiKey: "k",
    fetchImpl: (async (_u: unknown, init?: { body?: string }) => {
      const b = init?.body ?? "";
      bodies.push(b);
      const col = b.includes('"collectionId":"chapters"') ? "chapters" : "writingProjects";
      return { ok: true, json: async () => byCollection[col] ?? [] } as Response;
    }) as unknown as typeof fetch,
  });
}

describe("worksRepo.server", () => {
  it("প্রজেক্ট ও অধ্যায় আলাদা query; অধ্যায়-query-তে projectId+status+visibility filter", async () => {
    const bodies: string[] = [];
    const r = await src({ writingProjects: [proj("a")], chapters: [chap("c1", "a")] }, bodies).listPublic();
    expect(r.projects.map((p) => p.id)).toEqual(["a"]);
    expect(r.chapters.map((c) => c.id)).toEqual(["c1"]);
    const cq = bodies.find((b) => b.includes('"collectionId":"chapters"')) ?? "";
    expect(cq).toContain('"projectId"');
    expect(cq).toContain('"published"');
    expect(cq).toContain('"public"');
  });
  it("defense-in-depth: draft/private/অন্য-প্রজেক্ট/বিকৃত বাদ; প্রজেক্ট ছাড়া অধ্যায় query-ই হয় না", async () => {
    const r = await src({
      writingProjects: [proj("a"), proj("d", { status: { stringValue: "draft" } }), proj("bad", { type: { stringValue: "poem" } })],
      chapters: [chap("ok", "a"), chap("dr", "a", { status: { stringValue: "draft" } }), chap("pv", "a", { visibility: { stringValue: "private" } }), chap("other", "zzz"), chap("bad", "a", { order: { stringValue: "x" } })],
    }).listPublic();
    expect(r.projects.map((p) => p.id)).toEqual(["a"]);
    expect(r.chapters.map((c) => c.id)).toEqual(["ok"]);
  });
  it("REST error item → throw", async () => {
    await expect(src({ writingProjects: [{ error: { message: "x" } }] }).listPublic()).rejects.toThrow();
  });
});
