import { describe, expect, it } from "vitest";
import { CreateMediaSchema, PublicMediaSchema, toPublicMedia, parseMedia } from "./mediaRepo";
import { PostPatchSchema } from "./postRepo";

const base = {
  cloudinaryPublicId: "blog/abc",
  cloudinaryUrl: "https://res.cloudinary.com/demo/image/upload/v1/blog/abc.jpg",
  deliveryType: "upload",
  visibility: "public",
  fileName: "a.jpg",
  type: "image",
  size: 10,
  ownerUid: "u",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("toPublicMedia / PublicMediaSchema", () => {
  it("public ছবি ⇒ শুধু নির্ধারিত ফিল্ড", () => {
    const m = parseMedia("a", { ...base, width: 100, height: 50, altText: "x", location: "গোপন" });
    expect(toPublicMedia(m)).toEqual({ id: "a", cloudinaryPublicId: "blog/abc", cloudinaryUrl: base.cloudinaryUrl, width: 100, height: 50, altText: "x" });
  });
  it("private/ফাইল/URL-ছাড়া ⇒ null", () => {
    expect(toPublicMedia(parseMedia("a", { ...base, visibility: "private", deliveryType: "authenticated" }))).toBeNull();
    expect(toPublicMedia(parseMedia("a", { ...base, type: "file" }))).toBeNull();
    expect(toPublicMedia(parseMedia("a", { ...base, cloudinaryUrl: undefined }))).toBeNull();
  });
  it("snapshot-এর বিকৃত এন্ট্রি প্রত্যাখ্যাত", () => {
    expect(PublicMediaSchema.safeParse({ id: "a", cloudinaryPublicId: "../x", cloudinaryUrl: base.cloudinaryUrl }).success).toBe(false);
    expect(PublicMediaSchema.safeParse({ id: "a", cloudinaryPublicId: "blog/a", cloudinaryUrl: "http://x.test/a" }).success).toBe(false);
  });
  it("অচেনা visibility ⇒ private (সংরক্ষণশীল) ⇒ পাবলিকে যায় না", () => {
    expect(toPublicMedia(parseMedia("a", { ...base, visibility: "weird" }))).toBeNull();
  });
});

describe("CreateMediaSchema কঠোরতা", () => {
  it("public ছবি বৈধ; location বা URL-হীনতা প্রত্যাখ্যাত", () => {
    expect(CreateMediaSchema.safeParse({ ...base, createdAt: undefined }).success).toBe(true);
    expect(CreateMediaSchema.safeParse({ ...base, location: "ঢাকা" }).success).toBe(false);
    expect(CreateMediaSchema.safeParse({ ...base, cloudinaryUrl: undefined }).success).toBe(false);
  });
});

describe("PostPatchSchema.coverMediaId", () => {
  it("string/null/অনুপস্থিত বৈধ; খালি/অতি-দীর্ঘ অবৈধ", () => {
    expect(PostPatchSchema.safeParse({ coverMediaId: "abc123" }).success).toBe(true);
    expect(PostPatchSchema.safeParse({ coverMediaId: null }).success).toBe(true);
    expect(PostPatchSchema.safeParse({}).success).toBe(true);
    expect(PostPatchSchema.safeParse({ coverMediaId: "" }).success).toBe(false);
    expect(PostPatchSchema.safeParse({ coverMediaId: "a".repeat(41) }).success).toBe(false);
  });
});
