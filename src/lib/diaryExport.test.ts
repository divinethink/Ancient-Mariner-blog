import { describe, expect, it } from "vitest";
import { bn } from "../i18n/bn";
import { estimatePages, dayParts, fetchRange, fileName, rangeFor, rangeLabel, selectEntries, splitByYear, toEntries } from "./diaryExport";
import { textToDoc } from "./diary";
import { serializeDoc } from "./editorDoc";

const T = "2026-10-26";

describe("rangeFor", () => {
  it("দিন/মাস/বছর/সব", () => {
    expect(rangeFor("day", "2026-10-25", T)).toEqual({ from: "2026-10-25", to: "2026-10-25" });
    expect(rangeFor("month", "2026-10-25", T)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(rangeFor("year", "2026-10-25", T)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(rangeFor("all", "2026-10-25", T)).toEqual({ from: "0000-01-01", to: T });
  });
  it("অবৈধ নির্বাচিত দিন বা custom ⇒ null", () => {
    expect(rangeFor("day", "bad", T)).toBeNull();
    expect(rangeFor("custom", "2026-10-25", T)).toBeNull();
    expect(rangeFor("custom", "x", T, { from: "2026-10-02", to: "2026-10-01" })).toBeNull();
    expect(rangeFor("custom", "x", T, { from: "2026-10-01", to: "2026-10-27" })).toBeNull(); // ভবিষ্যৎ
    expect(rangeFor("custom", "x", T, { from: "2026-02-30", to: "2026-03-01" })).toBeNull();
    expect(rangeFor("custom", "x", T, { from: "2026-10-01", to: "2026-10-26" })).toEqual({ from: "2026-10-01", to: "2026-10-26" });
  });
});

describe("rangeLabel / fileName", () => {
  it("বাংলা নাম ও ASCII ফাইল-নাম", () => {
    expect(rangeLabel("year", { from: "2026-01-01", to: "2026-12-31" })).toBe("২০২৬");
    expect(rangeLabel("month", { from: "2026-10-01", to: "2026-10-31" })).toBe("অক্টোবর ২০২৬");
    expect(rangeLabel("day", { from: "2026-10-25", to: "2026-10-25" })).toBe("২৫ অক্টোবর ২০২৬");
    expect(rangeLabel("custom", { from: "2026-10-01", to: "2026-10-25" })).toBe("১ অক্টোবর ২০২৬ – ২৫ অক্টোবর ২০২৬");
    expect(rangeLabel("all", { from: "0000-01-01", to: T })).toBe(bn.diary.dl.all);
    expect(fileName("month", { from: "2026-10-01", to: "2026-10-31" }, "docx")).toBe("dinolipi-2026-10.docx");
    expect(fileName("all", { from: "0000-01-01", to: T }, "pdf")).toBe("dinolipi-all.pdf");
    expect(fileName("custom", { from: "2026-10-01", to: "2026-10-25" }, "pdf")).toBe("dinolipi-2026-10-01_2026-10-25.pdf");
    expect(fileName("custom", { from: "2026-10-05", to: "2026-10-05" }, "pdf")).toBe("dinolipi-2026-10-05.pdf");
  });
});

describe("splitByYear / fetchRange", () => {
  it("বছরভিত্তিক টুকরো; প্রান্ত কাটা; ভবিষ্যৎ ও MIN_YEAR-এর আগের বছর বাদ", () => {
    expect(splitByYear({ from: "2025-11-10", to: "2027-02-03" }, 2026)).toEqual([
      { from: "2025-11-10", to: "2025-12-31" },
      { from: "2026-01-01", to: "2026-12-31" },
    ]);
    expect(splitByYear({ from: "0000-01-01", to: "2026-10-26" }, 2026)).toHaveLength(2026 - 1990 + 1);
    expect(splitByYear({ from: "2026-10-05", to: "2026-10-05" }, 2026)).toEqual([{ from: "2026-10-05", to: "2026-10-05" }]);
  });
  it("সব টুকরো আনে, একই id একবার; একটা ব্যর্থ হলে পুরোটা throw", async () => {
    const seen: string[] = [];
    const list = async (r: { from: string; to: string }) => {
      seen.push(`${r.from}..${r.to}`);
      return [{ id: `a-${r.from.slice(0, 4)}` }, { id: "dup" }];
    };
    const out = await fetchRange(list, { from: "2025-01-01", to: "2026-12-31" }, 2026);
    expect(out.map((x) => x.id)).toEqual(["a-2025", "dup", "a-2026"]);
    expect(seen).toHaveLength(2);
    await expect(fetchRange(async () => { throw new Error("x"); }, { from: "2026-01-01", to: "2026-02-01" }, 2026)).rejects.toThrow();
  });
});

const post = (over: Record<string, unknown>) => ({
  id: "p", title: "", body: serializeDoc(textToDoc("হ্যালো\n\nবিদায়")), status: "draft", visibility: "private", contentType: "diary", date: "2026-10-25", createdAt: new Date("2026-10-25T10:00:00Z"), ...over,
});

describe("selectEntries / toEntries", () => {
  it("শুধু দিনলিপি, trashed বাদ, দিন-ক্রম; onlyPublic = প্রকাশিত+public", () => {
    const list = [
      post({ id: "b", date: "2026-10-26" }),
      post({ id: "a", date: "2026-10-24", status: "published", visibility: "public" }),
      post({ id: "t", status: "trashed" }),
      post({ id: "n", contentType: "post" }),
    ];
    expect(selectEntries(list, false).map((p) => p.id)).toEqual(["a", "b"]);
    expect(selectEntries(list, true).map((p) => p.id)).toEqual(["a"]);
  });
  it("একই দিনে তৈরির সময়-ক্রম", () => {
    const l = [post({ id: "late", createdAt: new Date("2026-10-25T20:00:00Z") }), post({ id: "early" })];
    expect(selectEntries(l, false).map((p) => p.id)).toEqual(["early", "late"]);
  });
  it("toEntries: লাইন (খালি লাইন কেটে যায়), স্বয়ংক্রিয় শিরোনাম বাদ, নিজে-দেওয়া থাকে", () => {
    const e = toEntries([post({ title: "নরসিংদী ভ্রমণ", location: "নারসিংদী" }), post({ id: "q", title: "" })]);
    expect(e[0]).toMatchObject({ day: "2026-10-25", title: "নরসিংদী ভ্রমণ", location: "নারসিংদী" });
    expect(e[0]!.lines).toEqual(["হ্যালো", "বিদায়"]);
    expect(e[1]!.title).toBe("");
  });
});

describe("dayParts / estimatePages", () => {
  it("dayParts", () => {
    expect(dayParts("2026-10-25")).toEqual({ num: "২৫", monthYear: "অক্টোবর ২০২৬", weekday: "রবিবার", long: "২৫ অক্টোবর ২০২৬" });
    expect(dayParts("2026-02-30")).toBeNull();
  });
  it("মলাটসহ আনুমানিক পাতা; ফাঁকা এন্ট্রিও ১ পাতা", () => {
    expect(estimatePages([])).toBe(1);
    expect(estimatePages([{ id: "1", day: "2026-10-25", title: "", lines: [] }])).toBe(2);
    expect(estimatePages([{ id: "1", day: "2026-10-25", title: "", lines: ["অ".repeat(34 * 30)] }])).toBe(1 + 2);
  });
});
