import { describe, expect, it, vi } from "vitest";
import { createPublicPostSource } from "./postRepo.server";

const doc = (id: string, f: Record<string, unknown>) => ({
  document: {
    name: `projects/p/databases/(default)/documents/posts/${id}`,
    fields: {
      title: { stringValue: "শিরোনাম " + id },
      slug: { stringValue: "slug-" + id },
      body: { stringValue: "{}" },
      status: { stringValue: "published" },
      visibility: { stringValue: "public" },
      ownerUid: { stringValue: "u1" },
      createdAt: { timestampValue: "2026-10-01T00:00:00Z" },
      updatedAt: { timestampValue: "2026-10-01T00:00:00Z" },
      publishedAt: { timestampValue: "2026-10-01T00:00:00Z" },
      wordCount: { integerValue: "12" },
      ...f,
    },
  },
});
const resp = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const make = (fetchImpl: typeof fetch) =>
  createPublicPostSource({ projectId: "proj", apiKey: "KEY123", fetchImpl });

describe("listPublished (REST)", () => {
  it("query পাঠায়, ক্রম ঠিক রেখে PostWithId ফেরত দেয়", async () => {
    const f = vi.fn(() => resp([doc("b", {}), doc("a", {})]));
    const posts = await make(f as unknown as typeof fetch).listPublished();
    expect(posts.map((p) => p.id)).toEqual(["b", "a"]);
    expect(posts[0].wordCount).toBe(12);
    expect(posts[0].publishedAt).toBeInstanceOf(Date);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("projects/proj/databases/(default)/documents:runQuery?key=KEY123");
    expect(init.method).toBe("POST");
    expect(String(init.body)).toContain('"stringValue":"published"');
  });
  it("REST-এর array/integer সংগঠন-ফিল্ড decode হয় (P3a-৩)", async () => {
    const f = vi.fn(() =>
      resp([
        doc("a", {
          categoryId: { stringValue: "c1" },
          categoryName: { stringValue: "ভ্রমণ" },
          tagIds: { arrayValue: { values: [{ stringValue: "t1" }, { stringValue: "t2" }] } },
          tagNames: { arrayValue: { values: [{ stringValue: "সমুদ্র" }, { stringValue: "ছুটি" }] } },
          seriesId: { stringValue: "s1" },
          seriesOrder: { integerValue: "4" },
        }),
      ]),
    );
    const [p] = await make(f as unknown as typeof fetch).listPublished();
    expect(p).toMatchObject({
      categoryId: "c1",
      categoryName: "ভ্রমণ",
      tagIds: ["t1", "t2"],
      tagNames: ["সমুদ্র", "ছুটি"],
      seriesId: "s1",
      seriesOrder: 4,
    });
  });
  it("সংগঠনহীন খালি tagIds (arrayValue খালি) → []", async () => {
    const f = vi.fn(() => resp([doc("a", { tagIds: { arrayValue: {} }, tagNames: { arrayValue: {} } })]));
    const [p] = await make(f as unknown as typeof fetch).listPublished();
    expect(p.tagIds).toEqual([]);
  });
  it("খালি ফল (শুধু readTime) → []", async () => {
    const f = vi.fn(() => resp([{ readTime: "2026-10-05T00:00:00Z" }]));
    expect(await make(f as unknown as typeof fetch).listPublished()).toEqual([]);
  });
  it("বিকৃত doc বাদ যায়, বাকি থাকে", async () => {
    const f = vi.fn(() => resp([doc("a", {}), doc("bad", { status: { stringValue: "weird" } })]));
    const posts = await make(f as unknown as typeof fetch).listPublished();
    expect(posts.map((p) => p.id)).toEqual(["a"]);
  });
  it("error আইটেমে ব্যর্থ; বার্তায় key নেই", async () => {
    const f = vi.fn(() => resp([{ error: { message: "boom" } }]));
    await expect(make(f as unknown as typeof fetch).listPublished()).rejects.toThrow("boom");
  });
  it("HTTP ব্যর্থতায় retry-র পর throw; বার্তায় key নেই", async () => {
    vi.useFakeTimers();
    const f = vi.fn(() => resp({}, 403));
    const p = make(f as unknown as typeof fetch).listPublished();
    const assertion = expect(p).rejects.toThrow(/Firestore REST 403/);
    await vi.runAllTimersAsync();
    await assertion;
    expect(f).toHaveBeenCalledTimes(3);
    await p.catch((e: Error) => expect(e.message).not.toContain("KEY123"));
    vi.useRealTimers();
  });
});
