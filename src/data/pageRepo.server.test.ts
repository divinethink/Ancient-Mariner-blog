import { describe, expect, it } from "vitest";
import { createPublicPageSource } from "./pageRepo.server";

const doc = (id: string, f: Record<string, unknown>) => ({
  document: {
    name: `projects/p/databases/(default)/documents/pages/${id}`,
    fields: {
      title: { stringValue: "শিরোনাম" },
      body: { stringValue: "{}" },
      ownerUid: { stringValue: "u" },
      createdAt: { timestampValue: "2026-10-01T00:00:00Z" },
      updatedAt: { timestampValue: "2026-10-01T00:00:00Z" },
      status: { stringValue: "published" },
      ...f,
    },
  },
});
const src = (items: unknown[], capture?: { body?: string }) =>
  createPublicPageSource({
    projectId: "p",
    apiKey: "k",
    fetchImpl: (async (_u: unknown, init?: { body?: string }) => {
      if (capture) capture.body = init?.body;
      return { ok: true, json: async () => items } as Response;
    }) as unknown as typeof fetch,
  });

describe("pageRepo.server", () => {
  it("query-তে status==published filter; বৈধ পেজ ফেরে, বিকৃত বাদ, draft বাদ", async () => {
    const cap: { body?: string } = {};
    const pages = await src(
      [doc("about", {}), doc("bad", { status: { stringValue: "nope" } }), doc("d", { status: { stringValue: "draft" } }), { readTime: "x" }],
      cap,
    ).listPublished();
    expect(pages.map((p) => p.slug)).toEqual(["about"]);
    expect(cap.body).toContain('"collectionId":"pages"');
    expect(cap.body).toContain('"published"');
  });
  it("REST error item → throw", async () => {
    await expect(src([{ error: { message: "x" } }]).listPublished()).rejects.toThrow();
  });
});
