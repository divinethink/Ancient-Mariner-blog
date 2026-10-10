import { describe, expect, it } from "vitest";
import { archiveMonths, archivePath, archiveScopeKey, buildCalendar, groupByMonth, parseMonthParams } from "./archive";

const TZ = "Asia/Dhaka";
const r = (href: string, iso?: string) => ({ href, ...(iso && { dateISO: iso }) });

describe("archive", () => {
  it("পথ ও key ASCII, মাস ২ অঙ্কের", () => {
    expect(archivePath(2026, 9)).toBe("/archive/2026/09");
    expect(archiveScopeKey(2026, 9)).toBe("a-2026-09");
  });
  it("parseMonthParams: বৈধ/অবৈধ", () => {
    expect(parseMonthParams("2026", "09")).toEqual({ y: 2026, m: 9 });
    expect(parseMonthParams("2026", "9")).toBeNull();
    expect(parseMonthParams("2026", "13")).toBeNull();
    expect(parseMonthParams("26", "09")).toBeNull();
  });
  it("মাস সাইট-timezone-এ: UTC ৩০ সেপ্টে ১৯:০০ = ঢাকায় ১ অক্টোবর", () => {
    const m = archiveMonths([r("/a", "2026-09-30T19:00:00Z"), r("/b", "2026-09-30T05:00:00Z")], TZ);
    expect(m.map((x) => `${x.key}:${x.count}`)).toEqual(["2026-10:1", "2026-09:1"]);
  });
  it("নতুন→পুরনো ক্রম; তারিখহীন ও অবৈধ তারিখ বাদ; মাসের ভেতরে ইনপুট-ক্রম", () => {
    const refs = [r("/1", "2026-09-12T00:00:00Z"), r("/2"), r("/3", "bad"), r("/4", "2026-09-03T00:00:00Z"), r("/5", "2025-12-01T00:00:00Z")];
    expect(archiveMonths(refs, TZ).map((x) => x.key)).toEqual(["2026-09", "2025-12"]);
    expect(groupByMonth(refs, TZ).get("2026-09")?.items.map((x) => x.href)).toEqual(["/1", "/4"]);
  });
  it("পঞ্জিকা: একটা লেখা = পোস্টে, একাধিক = মাস-archive-এ, নেই = লিংক নেই", () => {
    const refs = [r("/a", "2026-09-12T06:00:00Z"), r("/b", "2026-09-03T06:00:00Z"), r("/c", "2026-09-03T08:00:00Z")];
    const c = buildCalendar(refs, TZ, 2026, 9);
    expect(c.cells).toHaveLength(30);
    expect(c.cells[11]).toEqual({ day: 12, href: "/a" });
    expect(c.cells[2]).toEqual({ day: 3, href: "/archive/2026/09" });
    expect(c.cells[0].href).toBeUndefined();
    expect(c.lead).toBe(2); // ১ সেপ্টে ২০২৬ = মঙ্গলবার (রবিবার = ০)
  });
  it("prev/next = লেখা-আছে এমন কাছের মাস (ফাঁকা মাস টপকে)", () => {
    const refs = [r("/a", "2026-10-02T06:00:00Z"), r("/b", "2026-07-02T06:00:00Z"), r("/c", "2026-03-02T06:00:00Z")];
    const c = buildCalendar(refs, TZ, 2026, 7);
    expect(c.prev).toBe("/archive/2026/03");
    expect(c.next).toBe("/archive/2026/10");
    expect(buildCalendar(refs, TZ, 2026, 10).next).toBeUndefined();
  });
  it("লেখাহীন মাসেও কাজ করে; ফেব্রুয়ারি ২৮/২৯", () => {
    expect(buildCalendar([], TZ, 2028, 2).cells).toHaveLength(29);
    expect(buildCalendar([], TZ, 2026, 2).cells).toHaveLength(28);
  });
});
