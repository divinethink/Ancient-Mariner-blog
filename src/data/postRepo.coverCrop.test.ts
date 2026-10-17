import { describe, expect, it } from "vitest";
import { parsePost, PostPatchSchema } from "./postRepo";

const base = { title: "t", slug: "s", body: "{}", status: "draft", visibility: "private", ownerUid: "o", createdAt: new Date(), updatedAt: new Date() };

describe("coverCrop schema (additive)", () => {
  it("পুরনো doc অক্ষত; বিকৃত ক্রপ শুধু বাদ; বৈধটি থাকে", () => {
    expect(parsePost("a", base).coverCrop).toBeUndefined();
    expect(parsePost("a", { ...base, coverCrop: { ratio: "x", focus: "y" } }).coverCrop).toBeUndefined();
    expect(parsePost("a", { ...base, coverCrop: { ratio: "3:1", focus: "end" } }).coverCrop).toEqual({ ratio: "3:1", focus: "end" });
  });
  it("patch: null = সরানো; অবৈধ মান প্রত্যাখ্যাত", () => {
    expect(PostPatchSchema.safeParse({ coverCrop: null }).success).toBe(true);
    expect(PostPatchSchema.safeParse({ coverCrop: { ratio: "16:9", focus: "center" } }).success).toBe(true);
    expect(PostPatchSchema.safeParse({ coverCrop: { ratio: "7:7", focus: "center" } }).success).toBe(false);
  });
});
