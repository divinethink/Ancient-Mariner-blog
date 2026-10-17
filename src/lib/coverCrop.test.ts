import { describe, expect, it } from "vitest";
import { resolveCover } from "./cards";
import { cropStyle, sameCrop, toCoverCrop } from "./coverCrop";

describe("coverCrop", () => {
  it("toCoverCrop: শুধু বৈধ মান; বাকি = পুরো ছবি (undefined)", () => {
    expect(toCoverCrop({ ratio: "3:1", focus: "end" })).toEqual({ ratio: "3:1", focus: "end" });
    expect(toCoverCrop({ ratio: "9:9", focus: "end" })).toBeUndefined();
    expect(toCoverCrop({ ratio: "3:1" })).toBeUndefined();
    expect(toCoverCrop(null)).toBeUndefined();
  });
  it("cropStyle ও sameCrop", () => {
    expect(cropStyle({ ratio: "16:9", focus: "start" })).toEqual({ aspectRatio: "16 / 9", objectPosition: "0% 0%" });
    expect(cropStyle(undefined)).toEqual({});
    expect(sameCrop(null, undefined)).toBe(true);
    expect(sameCrop({ ratio: "1:1", focus: "center" }, null)).toBe(false);
  });
  it("resolveCover: crop থাকলে বহন করে, নইলে ফিল্ডই নেই", () => {
    const media = new Map([["a", { cloudinaryPublicId: "blog/a", cloudinaryUrl: "https://res.cloudinary.com/demo/image/upload/v1/blog/a.jpg", width: 800, height: 600 }]]);
    expect(resolveCover("a", media, { ratio: "2:1", focus: "center" })?.crop).toEqual({ ratio: "2:1", focus: "center" });
    expect(resolveCover("a", media)).not.toHaveProperty("crop");
  });
});
