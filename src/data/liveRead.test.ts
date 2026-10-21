import { describe, expect, it, vi } from "vitest";
import { fetchLivePost, liveSlugQuery, parseLiveSlug } from "./liveRead";

const str = (v: string) => ({ stringValue: v });
const doc = (over: Record<string, unknown> = {}) => ({
  name: "projects/p/databases/(default)/documents/posts/abc",
  fields: {
    title: str("নতুন লেখা"),
    slug: str("notun"),
    body: str('{"type":"doc","content":[{"type":"paragraph"}]}'),
    status: str("published"),
    visibility: str("public"),
    contentType: str("post"),
    wordCount: { integerValue: "12" },
    ownerUid: str("u"),
    schemaVersion: { integerValue: "1" },
    createdAt: { timestampValue: "2026-10-22T00:00:00Z" },
    updatedAt: { timestampValue: "2026-10-22T00:00:00Z" },
    publishedAt: { timestampValue: "2026-10-22T00:00:00Z" },
    ...over,
  },
});
const mk = (items: unknown) => vi.fn(async () => new Response(JSON.stringify(items), { status: 200 })) as unknown as typeof fetch;

describe("parseLiveSlug", () => {
  it("বাংলা (encoded) slug ঠিক; অবৈধ বাদ", () => {
    expect(parseLiveSlug(encodeURIComponent("ভ্রমণ-১"))).toBe("ভ্রমণ-১");
    expect(parseLiveSlug("a%2Fb")).toBeNull();
    expect(parseLiveSlug("%E0%A4%A")).toBeNull();
    expect(parseLiveSlug("")).toBeNull();
    expect(parseLiveSlug("x".repeat(201))).toBeNull();
  });
});

describe("liveSlugQuery", () => {
  it("শুধু published+public+slug, limit ১", () => {
    const q = liveSlugQuery("s").structuredQuery;
    expect(q.limit).toBe(1);
    const f = q.where.compositeFilter.filters.map((x) => `${x.fieldFilter.field.fieldPath}=${x.fieldFilter.value.stringValue}`);
    expect(f).toEqual(["status=published", "visibility=public", "slug=s"]);
  });
});

describe("fetchLivePost", () => {
  const base = { projectId: "p", apiKey: "k", slug: "notun" };
  it("পেলে লেখা ফেরায়", async () => {
    const p = await fetchLivePost({ ...base, fetchImpl: mk([{ document: doc() }]) });
    expect(p?.title).toBe("নতুন লেখা");
    expect(p?.media).toEqual({});
  });
  it("খালি ফল = null", async () => {
    expect(await fetchLivePost({ ...base, fetchImpl: mk([{ readTime: "x" }]) })).toBeNull();
  });
  it("অন্য অবস্থা/দিনলিপি/অন্য slug = null (defense-in-depth)", async () => {
    expect(await fetchLivePost({ ...base, fetchImpl: mk([{ document: doc({ visibility: str("unlisted") }) }]) })).toBeNull();
    expect(await fetchLivePost({ ...base, fetchImpl: mk([{ document: doc({ status: str("draft") }) }]) })).toBeNull();
    expect(await fetchLivePost({ ...base, fetchImpl: mk([{ document: doc({ contentType: str("diary") }) }]) })).toBeNull();
    expect(await fetchLivePost({ ...base, fetchImpl: mk([{ document: doc({ slug: str("other") }) }]) })).toBeNull();
  });
  it("Firestore ত্রুটিতে throw (key log-এ নয়)", async () => {
    const f = vi.fn(async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    await expect(fetchLivePost({ ...base, fetchImpl: f })).rejects.toThrow("Firestore REST 500");
  });
});
