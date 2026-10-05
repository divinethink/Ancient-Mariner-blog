import { describe, expect, it } from "vitest";
import { parsePublishDate } from "./publish";

const NOW = Date.parse("2026-10-05T12:00:00Z");
describe("parsePublishDate", () => {
  it("খালি = প্রকাশের মুহূর্ত", () => expect(parsePublishDate("", NOW)).toEqual({ ok: true, date: undefined }));
  it("অতীত তারিখ ঠিক (Asia/Dhaka)", () => {
    const r = parsePublishDate("2026-10-01T10:00", NOW);
    expect(r.ok && r.date?.toISOString()).toBe("2026-10-01T04:00:00.000Z");
  });
  it("ভবিষ্যৎ ও অবৈধ প্রত্যাখ্যাত", () => {
    expect(parsePublishDate("2026-12-01T10:00", NOW)).toEqual({ ok: false, reason: "future" });
    expect(parsePublishDate("xx", NOW)).toEqual({ ok: false, reason: "invalid" });
  });
});
