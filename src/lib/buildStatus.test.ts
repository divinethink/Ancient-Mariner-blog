import { describe, expect, it } from "vitest";
import { STALE_AFTER_MS, buildState } from "./buildStatus";

describe("buildState", () => {
  const T = 1_000_000;
  it("build.json না পেলে unknown", () => {
    expect(buildState({ builtAt: null, changedAt: T, now: T })).toBe("unknown");
  });
  it("ক্রিয়া নেই বা build নতুনতর → ok", () => {
    expect(buildState({ builtAt: T, now: T + 9e9 })).toBe("ok");
    expect(buildState({ builtAt: T, changedAt: T - 1, now: T + 9e9 })).toBe("ok");
    expect(buildState({ builtAt: T, changedAt: T, now: T + 9e9 })).toBe("ok");
  });
  it("ক্রিয়া build-এর পরে: ৫ মিনিট পর্যন্ত pending, তারপর stale", () => {
    expect(buildState({ builtAt: T, changedAt: T + 1, now: T + 1 + STALE_AFTER_MS })).toBe("pending");
    expect(buildState({ builtAt: T, changedAt: T + 1, now: T + 2 + STALE_AFTER_MS })).toBe("stale");
  });
});
