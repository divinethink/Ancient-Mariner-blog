import { describe, expect, it } from "vitest";
import { createPublicMediaSource } from "./mediaRepo.server";

const okDoc = (id: string, f: Record<string, unknown> = {}) => ({
  name: `projects/p/databases/(default)/documents/media/${id}`,
  fields: {
    cloudinaryPublicId: { stringValue: `blog/${id}` },
    cloudinaryUrl: { stringValue: `https://res.cloudinary.com/demo/image/upload/v1/blog/${id}.jpg` },
    deliveryType: { stringValue: "upload" },
    visibility: { stringValue: "public" },
    fileName: { stringValue: "ছবি.jpg" },
    type: { stringValue: "image" },
    size: { integerValue: "1000" },
    width: { integerValue: "1600" },
    height: { integerValue: "900" },
    altText: { stringValue: "সৈকত" },
    location: { stringValue: "গোপন" },
    ownerUid: { stringValue: "u" },
    createdAt: { timestampValue: "2026-10-01T00:00:00Z" },
    updatedAt: { timestampValue: "2026-10-01T00:00:00Z" },
    ...f,
  },
});
const mk = (routes: Record<string, { status: number; body?: unknown }>, calls: string[] = []) =>
  createPublicMediaSource({
    projectId: "p",
    apiKey: "k",
    fetchImpl: (async (u: string) => {
      calls.push(u);
      const id = u.split("/media/")[1].split("?")[0];
      const r = routes[id] ?? { status: 404 };
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body } as Response;
    }) as unknown as typeof fetch,
  });

describe("mediaRepo.server", () => {
  it("public ছবি ফেরে; location/fileName snapshot-এ যায় না; 403/404/private/অ-ছবি/অবৈধ id বাদ; ডুপ্লিকেট id একবার", async () => {
    const calls: string[] = [];
    const out = await mk(
      {
        a1: { status: 200, body: okDoc("a1") },
        priv: { status: 403 },
        file1: { status: 200, body: okDoc("file1", { type: { stringValue: "file" } }) },
        pv: { status: 200, body: okDoc("pv", { visibility: { stringValue: "private" } }) },
      },
      calls,
    ).getMany(["a1", "priv", "gone", "file1", "pv", "a1", "bad/id"]);
    expect(out).toEqual([
      { id: "a1", cloudinaryPublicId: "blog/a1", cloudinaryUrl: "https://res.cloudinary.com/demo/image/upload/v1/blog/a1.jpg", width: 1600, height: 900, altText: "সৈকত" },
    ]);
    expect(JSON.stringify(out)).not.toContain("গোপন");
    expect(calls.filter((c) => c.includes("/media/a1")).length).toBe(1);
    expect(calls.some((c) => c.includes("bad"))).toBe(false);
    expect(calls[0]).toContain("key=k");
  });
  it("৫xx ⇒ throw (build থামে, নীরবে cover-হীন নয়)", async () => {
    await expect(mk({ a1: { status: 500 } }).getMany(["a1"])).rejects.toThrow(/500/);
  }, 15000);
});
