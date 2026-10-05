import { describe, expect, it } from "vitest";
import { IDLE_MS, MIN_INTERVAL_MS, remoteChanged, sameContent, syncDelay } from "./syncPlan";

describe("syncDelay", () => {
  it("manual = ০", () => expect(syncDelay("manual", 100, 100, 100)).toBe(0));
  it("idle: থামার পর IDLE_MS (আগের sync বহুদিন আগে)", () =>
    expect(syncDelay("idle", 1_000_000, 1_000_000, 0)).toBe(IDLE_MS));
  it("idle: সদ্য sync হলে ন্যূনতম ব্যবধান জেতে", () =>
    expect(syncDelay("idle", 1000, 1000, 1000)).toBe(MIN_INTERVAL_MS));
  it("blur: ব্যবধান পার হলে সাথে সাথে", () =>
    expect(syncDelay("blur", 100_000, 99_999, 0)).toBe(0));
  it("blur: ব্যবধান বাকি থাকলে বাকিটুকু", () =>
    expect(syncDelay("blur", 5000, 5000, 0)).toBe(MIN_INTERVAL_MS - 5000));
});

describe("remoteChanged", () => {
  it("base মিললে false, না মিললে true (দুই দিকেই)", () => {
    expect(remoteChanged(10, 10, 99)).toBe(false);
    expect(remoteChanged(11, 10, 99)).toBe(true);
    expect(remoteChanged(9, 10, 99)).toBe(true);
  });
  it("base নেই: রিমোট লোকালের পরে হলে true", () => {
    expect(remoteChanged(5, undefined, 10)).toBe(false);
    expect(remoteChanged(15, undefined, 10)).toBe(true);
  });
});

describe("sameContent", () => {
  const a = { title: "ক", body: "{}", excerpt: "খ" };
  it("সমান/ভিন্ন", () => {
    expect(sameContent(a, { ...a })).toBe(true);
    expect(sameContent(a, { ...a, body: "[]" })).toBe(false);
  });
});
