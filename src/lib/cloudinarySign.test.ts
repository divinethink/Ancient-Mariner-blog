import { describe, expect, it } from "vitest";
import { signParams, stringToSign } from "./cloudinarySign";

describe("cloudinarySign", () => {
  it("Cloudinary-র নথিভুক্ত উদাহরণের সাথে স্বাক্ষর মেলে", async () => {
    const sig = await signParams(
      { timestamp: 1315060510, public_id: "sample_image", eager: "w_400,h_300,c_pad|w_260,h_200,c_crop" },
      "abcd",
    );
    expect(sig).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });
  it("key সাজানো; খালি/undefined/null বাদ; boolean 'true'", () => {
    expect(stringToSign({ b: 2, a: "x", c: "", d: undefined, e: null, f: true })).toBe("a=x&b=2&f=true");
  });
  it("secret বদলালে স্বাক্ষর বদলায়", async () => {
    expect(await signParams({ a: 1 }, "s1")).not.toBe(await signParams({ a: 1 }, "s2"));
  });
});
