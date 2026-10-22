import { describe, expect, it } from "vitest";
import { addDays, isLetterOpen, isValidLetterDay, letterDaysLeft, minLetterDay, openAtFor } from "./letters";

const TZ = "Asia/Dhaka";
const NOW = Date.UTC(2026, 9, 22, 10, 0); // ঢাকায় ২২ অক্টোবর ১৬:০০

describe("letters", () => {
  it("addDays মাস/বছর পেরোয়, অবৈধ key অপরিবর্তিত", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("bad", 1)).toBe("bad");
  });
  it("সাইট-timezone-এর আগামীকাল (UTC-তে তারিখ না বদলালেও)", () => {
    expect(minLetterDay(NOW, TZ)).toBe("2026-10-23");
    expect(minLetterDay(Date.UTC(2026, 9, 22, 19, 0), TZ)).toBe("2026-10-24"); // ঢাকায় তখন ২৩ তারিখ ০১:০০
  });
  it("তারিখ-যাচাই", () => {
    expect(isValidLetterDay("2026-10-23", NOW, TZ)).toBe(true);
    expect(isValidLetterDay("2026-10-22", NOW, TZ)).toBe(false);
    expect(isValidLetterDay("2026-02-30", NOW, TZ)).toBe(false);
    expect(isValidLetterDay("2101-01-01", NOW, TZ)).toBe(false);
    expect(isValidLetterDay("abc", NOW, TZ)).toBe(false);
  });
  it("খোলার মুহূর্ত = সাইট-timezone-এর মধ্যরাত (UTC ১৮:০০)", () => {
    expect(openAtFor("2026-10-23", NOW, TZ)?.getTime()).toBe(Date.UTC(2026, 9, 22, 18, 0));
    expect(openAtFor("2026-10-22", NOW, TZ)).toBeNull();
  });
  it("দিন-গণনা ও খোলা-অবস্থা", () => {
    const open = new Date(Date.UTC(2026, 9, 22, 18, 0));
    expect(letterDaysLeft(open, NOW, TZ)).toBe(1);
    expect(letterDaysLeft(new Date(Date.UTC(2027, 9, 21, 18, 0)), NOW, TZ)).toBe(365);
    expect(isLetterOpen(open, open.getTime())).toBe(true);
    expect(isLetterOpen(open, open.getTime() - 1)).toBe(false);
    expect(letterDaysLeft(open, open.getTime(), TZ)).toBe(0);
  });
});
