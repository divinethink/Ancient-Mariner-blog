import { describe, expect, it } from "vitest";
import { buildDiaryMonth, diaryDayPath, diaryPreview, entryDay, groupByDay, heatLevel, latestDay } from "./diaryCalendar";
import { textToDoc } from "./diary";

const TZ = "Asia/Dhaka";
const post = (id: string, over: Partial<Parameters<typeof groupByDay>[0][number]> = {}) => ({
  id,
  title: "t",
  body: "{}",
  wordCount: 10,
  createdAt: new Date("2026-10-11T02:00:00Z"),
  ...over,
});

describe("entryDay", () => {
  it("বৈধ date-কে প্রাধান্য দেয়", () => expect(entryDay(post("a", { date: "2026-10-10" }), TZ)).toBe("2026-10-10"));
  it("অবৈধ/অনুপস্থিত date হলে publishedAt-এর সাইট-দিন", () => {
    expect(entryDay(post("a", { date: "2026-02-30", publishedAt: new Date("2026-10-10T19:00:00Z") }), TZ)).toBe("2026-10-11"); // Dhaka +6
    expect(entryDay(post("a"), TZ)).toBe("2026-10-11");
  });
});

describe("groupByDay", () => {
  it("একই দিনের একাধিক লেখা পুরনো আগে", () => {
    const m = groupByDay([post("b", { date: "2026-10-10", publishedAt: new Date("2026-10-11T05:00:00Z") }), post("a", { date: "2026-10-10", publishedAt: new Date("2026-10-11T01:00:00Z") })], TZ);
    expect(m.get("2026-10-10")?.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("heatLevel", () => {
  it("স্তর", () => {
    expect(heatLevel(0, false)).toBe(0);
    expect(heatLevel(0)).toBe(1);
    expect(heatLevel(61)).toBe(2);
    expect(heatLevel(151)).toBe(3);
    expect(heatLevel(301)).toBe(4);
  });
});

describe("buildDiaryMonth", () => {
  const days = new Map([
    ["2026-09-28", 40],
    ["2026-10-10", 200],
    ["2026-11-02", 400],
  ]);
  it("অক্টোবর ২০২৬: ১ তারিখ বৃহস্পতিবার (lead ৪), ৩১ ঘর, লেখা-দিনে লিংক ও স্তর", () => {
    const v = buildDiaryMonth(days, "2026-10");
    expect(v.lead).toBe(4);
    expect(v.cells).toHaveLength(31);
    expect(v.cells[9]).toEqual({ day: 10, key: "2026-10-10", level: 3, href: diaryDayPath("2026-10-10") });
    expect(v.cells[10]).toEqual({ day: 11, key: "2026-10-11", level: 0 });
  });
  it("prev/next = কাছের লেখা-আছে এমন মাসের দিন", () => {
    const v = buildDiaryMonth(days, "2026-10");
    expect(v.prev).toBe("/diary/2026-09-28");
    expect(v.next).toBe("/diary/2026-11-02");
    expect(buildDiaryMonth(days, "2026-11").next).toBeUndefined();
  });
  it("লেখা-ছাড়া মাসেও চলে", () => expect(buildDiaryMonth(days, "2026-02").cells).toHaveLength(28));
});

describe("latestDay", () => {
  it("সর্বশেষ", () => expect(latestDay(["2026-01-02", "2026-10-10", "2026-03-01"])).toBe("2026-10-10"));
  it("খালি", () => expect(latestDay([])).toBeUndefined());
});

describe("diaryPreview", () => {
  const lines = (n: number) => JSON.stringify(textToDoc(Array.from({ length: n }, (_, i) => `লাইন ${i + 1}`).join("\n")));
  it("৫০ বা কমে কাটে না", () => expect(diaryPreview(lines(50)).truncated).toBe(false));
  it("৫১ লাইনে ৫০টা রাখে ও truncated", () => {
    const r = diaryPreview(lines(51));
    expect(r.truncated).toBe(true);
    expect(JSON.parse(r.body).content).toHaveLength(50);
  });
  it("খালি লাইন গোনা হয় না", () => {
    const body = JSON.stringify(textToDoc("a\n\nb\n\nc"));
    const r = diaryPreview(body, 2);
    expect(r.truncated).toBe(true);
    expect(JSON.parse(r.body).content.filter((n: { content?: unknown }) => n.content)).toHaveLength(2);
  });
  it("বিকৃত body নিরাপদ", () => expect(diaryPreview("not json").truncated).toBe(false));
});
