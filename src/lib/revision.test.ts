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

import { intervalDue, REVISION_INTERVAL_MS } from "./revision";
describe("intervalDue", () => {
  it("নেই/অবৈধ ⇒ due; ১০ মিনিটের আগে নয়; পরে due; ঘড়ি পিছালে due", () => {
    const now = 1_000_000_000;
    expect(intervalDue(undefined, now)).toBe(true);
    expect(intervalDue(Number.NaN, now)).toBe(true);
    expect(intervalDue(now - REVISION_INTERVAL_MS + 1, now)).toBe(false);
    expect(intervalDue(now - REVISION_INTERVAL_MS, now)).toBe(true);
    expect(intervalDue(now + 5000, now)).toBe(true);
  });
});
