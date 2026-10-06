import { describe, expect, it } from "vitest";
import { nextVersionNumber, utf8Bytes } from "./revision";

describe("revision", () => {
  it("nextVersionNumber: নেই/অবৈধ ⇒ ১; নইলে +১", () => {
    expect(nextVersionNumber(undefined)).toBe(1);
    expect(nextVersionNumber(0)).toBe(1);
    expect(nextVersionNumber(Number.NaN)).toBe(1);
    expect(nextVersionNumber(1)).toBe(2);
    expect(nextVersionNumber(19)).toBe(20);
  });
  it("utf8Bytes: বাংলা ≈ ৩ byte/অক্ষর", () => {
    expect(utf8Bytes("abc")).toBe(3);
    expect(utf8Bytes("আ")).toBe(3);
  });
});
