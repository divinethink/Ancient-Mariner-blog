import { describe, expect, it } from "vitest";
import { DEFAULT_SEASON_PREF, parseSeasonPref, seasonOf, themeFor } from "./diarySeason";

describe("diarySeason", () => {
  it("ঋতুর সীমা", () => {
    const c: [string, string][] = [["2026-04-14", "boshonto"], ["2026-04-15", "grishmo"], ["2026-06-14", "grishmo"], ["2026-06-15", "borsha"], ["2026-08-15", "shorot"], ["2026-10-14", "shorot"], ["2026-10-26", "hemonto"], ["2026-12-14", "hemonto"], ["2026-12-15", "shit"], ["2027-02-14", "shit"], ["2027-02-15", "boshonto"], ["2026-01-01", "shit"]];
    for (const [d, s] of c) expect(seasonOf(d)).toBe(s);
    expect(seasonOf("x")).toBeNull();
    expect(seasonOf("2026-13-01")).toBeNull();
  });
  it("অবৈধ পছন্দ ডিফল্টে; বৈধ ঋতু-থিম রাখে", () => {
    expect(parseSeasonPref(null)).toEqual(DEFAULT_SEASON_PREF);
    expect(parseSeasonPref({ on: "yes", map: { shit: "nope" } })).toEqual(DEFAULT_SEASON_PREF);
    const p = parseSeasonPref({ on: true, map: { shit: "moon" } });
    expect(p.on).toBe(true);
    expect(p.map.shit).toBe("moon");
    expect(p.map.borsha).toBe("rain");
  });
  it("themeFor: বন্ধ থাকলে base, চালু থাকলে ঋতুর থিম", () => {
    expect(themeFor(DEFAULT_SEASON_PREF, "nbred", "2026-10-26")).toBe("nbred");
    expect(themeFor({ ...DEFAULT_SEASON_PREF, on: true }, "nbred", "2026-10-26")).toBe("lantern");
    expect(themeFor({ ...DEFAULT_SEASON_PREF, on: true }, "nbred", "bad")).toBe("nbred");
  });
});
