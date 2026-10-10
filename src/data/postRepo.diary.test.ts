import { describe, expect, it } from "vitest";
import { parsePost, PostPatchSchema } from "./postRepo";
import { fakeRepo } from "./syncTestKit";

const base = { title: "t", slug: "s", body: "{}", status: "draft", visibility: "private", ownerUid: "o", createdAt: new Date(), updatedAt: new Date() };

describe("P8a diary schema (additive)", () => {
  it("পুরনো doc (date/location/gallery নেই) অক্ষত", () => {
    const p = parsePost("a", base);
    expect(p.date).toBeUndefined();
    expect(p.gallery).toBeUndefined();
  });
  it("বৈধ ফিল্ড পড়ে; বিকৃত ফিল্ড শুধু বাদ, লেখা ভাঙে না", () => {
    const ok = parsePost("a", { ...base, date: "2026-10-10", location: "ঢাকা", gallery: ["m1"] });
    expect([ok.date, ok.location, ok.gallery]).toEqual(["2026-10-10", "ঢাকা", ["m1"]]);
    const bad = parsePost("a", { ...base, date: "2026-02-30", location: "x".repeat(121), gallery: Array(21).fill("m") });
    expect([bad.date, bad.location, bad.gallery]).toEqual([undefined, undefined, undefined]);
    expect(bad.title).toBe("t");
  });
  it("patch: null = সরানো; অবৈধ date প্রত্যাখ্যাত", () => {
    expect(PostPatchSchema.parse({ date: null }).date).toBeNull();
    expect(() => PostPatchSchema.parse({ date: "10-10-2026" })).toThrow();
  });
  it("create diary: একই id-তে দ্বিতীয় create duplicate করে না; listDiary ছাঁকে", async () => {
    const { repo } = fakeRepo();
    const i = { id: "d1", title: "x", body: "{}", contentType: "diary" as const, date: "2026-10-10" };
    await repo.create(i);
    await repo.create(i);
    await repo.create({ id: "p1", title: "y", body: "{}" });
    expect((await repo.listDiary({ from: "2026-10-01", to: "2026-10-31" })).map((p) => p.id)).toEqual(["d1"]);
    expect(await repo.listDiaryOn(["2025-10-10"])).toEqual([]);
  });
});
