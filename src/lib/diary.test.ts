import { describe, expect, it } from "vitest";
import { docToText } from "./editorDoc";
import { isValidDayKey, monthGrid, monthOf, monthRange, onThisDayKeys, shiftMonth, textToDoc } from "./diary";

describe("diary", () => {
  it("isValidDayKey", () => {
    expect(isValidDayKey("2026-10-10")).toBe(true);
    expect(isValidDayKey("2024-02-29")).toBe(true);
    expect(isValidDayKey("2026-02-29")).toBe(false);
    expect(isValidDayKey("2026-13-01")).toBe(false);
    expect(isValidDayKey("26-1-1")).toBe(false);
  });
  it("shiftMonth/monthOf/monthRange", () => {
    expect(monthOf("2026-10-10")).toBe("2026-10");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("bad", 1)).toBe("bad");
    expect(monthRange("2026-02")).toEqual(["2026-02-01", "2026-02-31"]);
  });
  it("monthGrid: অক্টোবর ২০২৬ শুরু বৃহস্পতিবার (৪ ঘর খালি), ৩১ দিন, ৫ সারি", () => {
    const g = monthGrid("2026-10");
    expect(g.every((r) => r.length === 7)).toBe(true);
    expect(g).toHaveLength(5);
    expect(g[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(g[0][4]).toEqual({ day: 1, key: "2026-10-01" });
    expect(g.flat().filter(Boolean)).toHaveLength(31);
    expect(monthGrid("x")).toEqual([]);
  });
  it("onThisDayKeys: ১–৫ বছর; ২৯ ফেব্রুয়ারি শুধু লিপ বছরে", () => {
    expect(onThisDayKeys("2026-10-10")).toEqual(["2025-10-10", "2024-10-10", "2023-10-10", "2022-10-10", "2021-10-10"]);
    expect(onThisDayKeys("2028-02-29")).toEqual(["2024-02-29"]);
    expect(onThisDayKeys("2026-10-10", 2)).toHaveLength(2);
    expect(onThisDayKeys("bad")).toEqual([]);
  });
  it("textToDoc: লাইন → paragraph; বাংলা অক্ষত", () => {
    const d = textToDoc("  আজ বৃষ্টি\n\nচা খেলাম \n");
    expect(d.content).toHaveLength(3);
    expect(d.content?.[1]).toEqual({ type: "paragraph" });
    expect(docToText(d)).toBe("আজ বৃষ্টি\nচা খেলাম");
  });
});
