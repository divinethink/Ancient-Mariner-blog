import { describe, expect, it, vi } from "vitest";
import { createPublicTaxonomySource } from "./taxonomyRepo.server";

const doc = (col: string, id: string, f: Record<string, unknown> = {}) => ({
  document: {
    name: `projects/p/databases/(default)/documents/${col}/${id}`,
    fields: {
      name: { stringValue: "নাম " + id },
      slug: { stringValue: "slug-" + id },
      ownerUid: { stringValue: "u1" },
      createdAt: { timestampValue: "2026-10-01T00:00:00Z" },
      updatedAt: { timestampValue: "2026-10-01T00:00:00Z" },
      ...f,
    },
  },
});
const resp = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("listAll (REST)", () => {
  it("তিন collection আলাদা query-তে পড়ে; বিকৃত doc বাদ", async () => {
    const f = vi.fn((_u: string, init: RequestInit) => {
      const b = String(init.body);
      if (b.includes('"categories"')) return resp([doc("categories", "c1"), { document: { name: "x/categories/bad", fields: {} } }]);
      if (b.includes('"tags"')) return resp([doc("tags", "t1")]);
      return resp([{ readTime: "x" }]); // খালি ফল
    });
    const out = await createPublicTaxonomySource({ projectId: "proj", apiKey: "KEY", fetchImpl: f as unknown as typeof fetch }).listAll();
    expect(out.categories.map((t) => t.id)).toEqual(["c1"]);
    expect(out.tags.map((t) => t.slug)).toEqual(["slug-t1"]);
    expect(out.series).toEqual([]);
    expect(f).toHaveBeenCalledTimes(3);
    expect(f.mock.calls[0][0]).toContain("documents:runQuery?key=KEY");
  });
  it("HTTP ব্যর্থ হলে throw (নীরবে খালি সাইট নয়); key বার্তায় নেই", async () => {
    const f = vi.fn(() => resp({}, 403));
    await expect(
      createPublicTaxonomySource({ projectId: "proj", apiKey: "SECRETKEY", fetchImpl: f as unknown as typeof fetch }).listAll(),
    ).rejects.toThrow(/403/);
    await createPublicTaxonomySource({ projectId: "proj", apiKey: "SECRETKEY", fetchImpl: f as unknown as typeof fetch })
      .listAll()
      .catch((e: Error) => expect(e.message).not.toContain("SECRETKEY"));
  });
});
