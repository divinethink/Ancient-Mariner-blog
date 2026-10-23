import { describe, expect, it } from "vitest";
import { daysSince, isSnoozed, pickStaleDraft, staleCutoff } from "./staleDrafts";

const NOW = Date.UTC(2026, 9, 23);
const DAY = 86_400_000;
const d = (id: string, ageDays: number, o: Record<string, unknown> = {}) => ({
  id,
  status: "draft",
  contentType: "story",
  wordCount: 120,
  updatedAt: new Date(NOW - ageDays * DAY),
  ...o,
});

describe("pickStaleDraft", () => {
  it("৩০ দিন বা বেশি পুরনো; এর মধ্যে সবচেয়ে সাম্প্রতিক", () => {
    expect(pickStaleDraft([d("a", 31), d("b", 90), d("c", 29)], NOW)?.id).toBe("a");
    expect(pickStaleDraft([d("x", 30)], NOW)?.id).toBe("x");
    expect(NOW - staleCutoff(NOW)).toBe(30 * DAY);
  });
  it("দিনলিপি, ইমপোর্ট, ফাঁকা, প্রকাশিত/ট্র্যাশ বাদ", () => {
    expect(pickStaleDraft([d("1", 40, { contentType: "diary" })], NOW)).toBeUndefined();
    expect(pickStaleDraft([d("2", 40, { importSource: { site: "s" } })], NOW)).toBeUndefined();
    expect(pickStaleDraft([d("3", 40, { wordCount: 0 })], NOW)).toBeUndefined();
    expect(pickStaleDraft([d("4", 40, { status: "published" }), d("5", 40, { status: "trashed" })], NOW)).toBeUndefined();
    expect(pickStaleDraft([], NOW)).toBeUndefined();
  });
});

describe("daysSince / isSnoozed", () => {
  it("দিন-গণনা (ঋণাত্মক নয়)", () => {
    expect(daysSince(new Date(NOW - 45 * DAY - 1000), NOW)).toBe(45);
    expect(daysSince(new Date(NOW + DAY), NOW)).toBe(0);
  });
  it("৭ দিন লুকানো; অবৈধ মান = লুকানো নয়", () => {
    expect(isSnoozed(NOW - 6 * DAY, NOW)).toBe(true);
    expect(isSnoozed(NOW - 7 * DAY, NOW)).toBe(false);
    expect(isSnoozed(undefined, NOW)).toBe(false);
    expect(isSnoozed("x", NOW)).toBe(false);
    expect(isSnoozed(Number.NaN, NOW)).toBe(false);
  });
});
