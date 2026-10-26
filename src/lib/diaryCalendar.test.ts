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

describe("groupByDay: প্রতি লেখার থিম", () => {
  it("diaryTheme থাকলে entry.theme-এ যায়, না থাকলে নেই", () => {
    const m = groupByDay([post("a", { date: "2026-10-10", diaryTheme: "fog" }), post("b", { date: "2026-10-11" })], TZ);
    expect(m.get("2026-10-10")?.[0]?.theme).toBe("fog");
    expect(m.get("2026-10-11")?.[0]).not.toHaveProperty("theme");
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
  const doc = (...paras: string[]) => JSON.stringify(textToDoc(paras.join("\n")));
  const text = (b: string) => JSON.parse(b).content.map((n: { content?: { text?: string }[] }) => (n.content ?? []).map((c) => c.text ?? "").join("")).join("|");
  it("৩০ শব্দ বা কমে কাটে না", () => expect(diaryPreview(doc(Array(30).fill("ক").join(" "))).truncated).toBe(false));
  it("নিকটতম দাঁড়িতে কাটে, বাক্য ভাঙে না", () => {
    const r = diaryPreview(doc("এক দুই তিন। চার পাঁচ ছয়। সাত আট নয়।"), 7);
    expect(r.truncated).toBe(true);
    expect(text(r.body)).toBe("এক দুই তিন। চার পাঁচ ছয়।");
  });
  it("প্রথম বাক্যই লম্বা হলে শব্দ-সীমায় কেটে …", () => {
    const r = diaryPreview(doc("এক দুই তিন চার পাঁচ ছয়"), 3);
    expect(r.truncated).toBe(true);
    expect(text(r.body)).toBe("এক দুই তিন…");
  });
  it("পরের অনুচ্ছেদ সীমা ছাড়ালে ও দাঁড়ি না মিললে বাদ", () => {
    const r = diaryPreview(doc("এক দুই।", "তিন চার পাঁচ ছয়"), 4);
    expect(r.truncated).toBe(true);
    expect(text(r.body)).toBe("এক দুই।");
  });
  it("খালি লাইন গোনা হয় না", () => expect(diaryPreview(doc("a", "", "b"), 2).truncated).toBe(false));
  it("বিকৃত body নিরাপদ", () => expect(diaryPreview("not json").truncated).toBe(false));
});

import { adjacentDays, buildYearView, diaryYears, sameDayEarlier, streakStats } from "./diaryCalendar";

describe("streakStats", () => {
  it("মোট/সর্বোচ্চ/সর্বশেষ টানা", () => {
    const s = streakStats(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-10", "2026-10-11", "2026-10-11"]);
    expect(s).toEqual({ total: 5, longest: 3, latest: 2 });
  });
  it("মাস/বছর পেরোলেও টানা", () => expect(streakStats(["2025-12-31", "2026-01-01"]).longest).toBe(2));
  it("খালি", () => expect(streakStats([])).toEqual({ total: 0, longest: 0, latest: 0 }));
});

describe("adjacentDays / diaryYears / sameDayEarlier", () => {
  const days = ["2024-10-11", "2025-10-11", "2026-10-02", "2026-10-10"];
  it("adjacent", () => {
    expect(adjacentDays(days, "2026-10-02")).toEqual({ prev: "2025-10-11", next: "2026-10-10" });
    expect(adjacentDays(days, "2024-10-11").prev).toBeUndefined();
    expect(adjacentDays(days, "2026-10-10").next).toBeUndefined();
  });
  it("years", () => expect(diaryYears(days)).toEqual([2026, 2025, 2024]));
  it("এই দিনে: শুধু আগের বছর, নতুন আগে", () => {
    expect(sameDayEarlier(days, "2026-10-11")).toEqual(["2025-10-11", "2024-10-11"]);
    expect(sameDayEarlier(days, "2025-10-11")).toEqual(["2024-10-11"]);
  });
});

describe("buildYearView", () => {
  const v = buildYearView(new Map([["2026-01-01", 10], ["2026-10-10", 400]]), 2026);
  it("৩৬৫ দিন, ৭-ঘরের সপ্তাহ, ১ জানুয়ারি ২০২৬ = বৃহস্পতিবার", () => {
    expect(v.weeks.every((w) => w.length === 7)).toBe(true);
    expect(v.weeks.flat().filter(Boolean)).toHaveLength(365);
    expect(v.weeks[0][4]).toEqual({ key: "2026-01-01", level: 1 });
    expect(v.writtenDays).toBe(2);
  });
  it("১২ মাস; লেখা-আছে এমন মাসে লিংক", () => {
    expect(v.months).toHaveLength(12);
    expect(v.months[0].href).toBe("/diary/2026-01-01");
    expect(v.months[1].href).toBeUndefined();
    expect(v.months[9].href).toBe("/diary/2026-10-10");
  });
  it("লিপ বছরে ৩৬৬", () => expect(buildYearView(new Map(), 2024).weeks.flat().filter(Boolean)).toHaveLength(366));
});

describe("groupByDay — স্থান ও শিরোনাম", () => {
  it("location থাকলে entry-তে আসে, না থাকলে ফিল্ডই নেই", () => {
    const m = groupByDay([post("a", { date: "2026-10-10", location: "ঢাকা" }), post("b", { date: "2026-10-09" })], TZ);
    expect(m.get("2026-10-10")?.[0].location).toBe("ঢাকা");
    expect(m.get("2026-10-09")?.[0]).not.toHaveProperty("location");
  });
});
