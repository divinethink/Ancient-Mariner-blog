import { describe, expect, it } from "vitest";
import { goalPercent, parseGoalDay, pickRandom, recordWords, wordsToday } from "./goal";

describe("goal", () => {
  it("প্রথম নথিভুক্তিতে base = initial; পরে base অপরিবর্তিত", () => {
    let d = recordWords({}, "a", 120, 100);
    expect(d.a).toEqual({ base: 100, cur: 120 });
    d = recordWords(d, "a", 150, 999);
    expect(d.a).toEqual({ base: 100, cur: 150 });
    expect(wordsToday(d)).toBe(50);
  });
  it("শব্দ কমলে ঋণাত্মক নয়; একাধিক লেখা যোগ হয়", () => {
    let d = recordWords({}, "a", 80, 100);
    d = recordWords(d, "b", 30, 0);
    expect(wordsToday(d)).toBe(30);
  });
  it("goalPercent সীমা ০–১০০", () => {
    expect(goalPercent(250, 500)).toBe(50);
    expect(goalPercent(900, 500)).toBe(100);
    expect(goalPercent(5, 0)).toBe(0);
  });
  it("parseGoalDay ভাঙা মানে খালি/শূন্য", () => {
    expect(parseGoalDay(null)).toEqual({});
    expect(parseGoalDay([1])).toEqual({});
    expect(parseGoalDay({ a: { base: -3, cur: "x" }, b: 5 })).toEqual({ a: { base: 0, cur: 0 } });
  });
  it("pickRandom: exclude মানে; একটাই থাকলে সেটাই; খালি → undefined", () => {
    const l = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(pickRandom(l, "a", () => 0)?.id).toBe("b");
    expect(pickRandom([{ id: "a" }], "a")?.id).toBe("a");
    expect(pickRandom([], "a")).toBeUndefined();
    expect(pickRandom(l, undefined, () => 0.999)?.id).toBe("c");
  });
});
