import { describe, expect, it } from "vitest";
import { daysUntil, nextOccurrence, sortUpcoming, validMonthDay, yearsAt } from "./specialDays";

describe("validMonthDay", () => {
  it("সীমা", () => {
    expect(validMonthDay(2, 29)).toBe(true);
    expect(validMonthDay(2, 30)).toBe(false);
    expect(validMonthDay(4, 31)).toBe(false);
    expect(validMonthDay(12, 31)).toBe(true);
    expect(validMonthDay(0, 1)).toBe(false);
    expect(validMonthDay(13, 1)).toBe(false);
    expect(validMonthDay(1.5, 1)).toBe(false);
  });
});

describe("nextOccurrence / daysUntil", () => {
  it("আজকের দিনই হলে আজ (০ দিন); পেরিয়ে গেলে আগামী বছর", () => {
    expect(nextOccurrence("2026-10-23", 10, 23)).toBe("2026-10-23");
    expect(daysUntil("2026-10-23", 10, 23)).toBe(0);
    expect(nextOccurrence("2026-10-23", 10, 22)).toBe("2027-10-22");
    expect(daysUntil("2026-10-23", 10, 24)).toBe(1);
  });
  it("বছর পেরোয়", () => {
    expect(nextOccurrence("2026-12-31", 1, 1)).toBe("2027-01-01");
    expect(daysUntil("2026-12-31", 1, 1)).toBe(1);
  });
  it("২৯ ফেব্রুয়ারি: নন-লিপে ২৮, লিপে ২৯", () => {
    expect(nextOccurrence("2026-10-23", 2, 29)).toBe("2027-02-28");
    expect(nextOccurrence("2027-10-23", 2, 29)).toBe("2028-02-29");
    expect(nextOccurrence("2028-01-01", 2, 29)).toBe("2028-02-29");
  });
});

describe("yearsAt / sortUpcoming", () => {
  it("বছর-গণনা", () => {
    expect(yearsAt("2027-10-22", 2000)).toBe(27);
    expect(yearsAt("2027-10-22", undefined)).toBeUndefined();
    expect(yearsAt("2027-10-22", 2027)).toBeUndefined();
  });
  it("আসন্ন ক্রম ও সীমা", () => {
    const items = [
      { id: "a", month: 11, day: 5 },
      { id: "b", month: 10, day: 25 },
      { id: "c", month: 10, day: 22 },
    ];
    expect(sortUpcoming(items, "2026-10-23").map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(sortUpcoming(items, "2026-10-23", 13).map((x) => x.id)).toEqual(["b", "a"]);
    expect(sortUpcoming(items, "2026-10-23", 12).map((x) => x.id)).toEqual(["b"]);
    expect(sortUpcoming(items, "2026-10-23", 12)[0]).toMatchObject({ inDays: 2, next: "2026-10-25" });
  });
});
