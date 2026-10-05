import { describe, expect, it } from "vitest";
import { analyticsToken, beaconAttr } from "./analytics";

describe("analyticsToken", () => {
  it("৩২-হেক্স গ্রহণ; trim", () => {
    expect(analyticsToken(` ${"a1".repeat(16)} `)).toBe("a1".repeat(16));
  });
  it("খালি/অনুপস্থিত/ভুল/ইনজেকশন → null", () => {
    for (const v of [undefined, "", "abc", "z".repeat(32), `${"a".repeat(31)}"}`]) expect(analyticsToken(v)).toBeNull();
  });
  it("attr JSON", () => {
    expect(beaconAttr("t")).toBe('{"token":"t"}');
  });
});
