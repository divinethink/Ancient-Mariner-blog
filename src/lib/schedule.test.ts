import { describe, expect, it } from "vitest";
import { MAX_PUBLISH_PER_RUN, isHeavySlot, parseScheduleInput, selectDue } from "./schedule";

const NOW = Date.UTC(2026, 9, 10, 12, 0);

describe("parseScheduleInput", () => {
  it("খালি/অবৈধ/অতীত/ঠিক", () => {
    expect(parseScheduleInput("", NOW)).toEqual({ ok: false, reason: "empty" });
    expect(parseScheduleInput("abc", NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(parseScheduleInput("2026-10-10T17:30", NOW, "Asia/Dhaka")).toEqual({ ok: false, reason: "past" }); // ১১:৩০ UTC
    expect(parseScheduleInput("2026-10-10T18:00", NOW, "Asia/Dhaka")).toEqual({ ok: false, reason: "past" }); // ঠিক এখন (<১ মিনিট লিড)
    const r = parseScheduleInput("2026-10-11T08:00", NOW, "Asia/Dhaka");
    expect(r.ok && r.date.toISOString()).toBe("2026-10-11T02:00:00.000Z");
  });
});

describe("selectDue", () => {
  const at = (h: number) => new Date(Date.UTC(2026, 9, 10, h, 0));
  it("শুধু সময়-হওয়াগুলো, পুরনো আগে; বিকৃত/নেই বাদ", () => {
    const rows = [{ id: "c", scheduledAt: at(11) }, { id: "a", scheduledAt: at(9) }, { id: "future", scheduledAt: at(13) }, { id: "none" }, { id: "bad", scheduledAt: new Date("x") }, { id: "eq", scheduledAt: at(12) }];
    expect(selectDue(rows, NOW).map((r) => r.id)).toEqual(["a", "c", "eq"]);
  });
  it("limit মানে", () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ id: String(i), scheduledAt: at(1) }));
    expect(selectDue(rows, NOW)).toHaveLength(MAX_PUBLISH_PER_RUN);
    expect(selectDue(rows, NOW, 3)).toHaveLength(3);
  });
});

describe("isHeavySlot", () => {
  it("UTC ০/৬/১২/১৮ টার প্রথম ১৫ মিনিট", () => {
    expect(isHeavySlot(Date.UTC(2026, 9, 10, 12, 0))).toBe(true);
    expect(isHeavySlot(Date.UTC(2026, 9, 10, 12, 14))).toBe(true);
    expect(isHeavySlot(Date.UTC(2026, 9, 10, 12, 15))).toBe(false);
    expect(isHeavySlot(Date.UTC(2026, 9, 10, 13, 0))).toBe(false);
    expect(isHeavySlot(Date.UTC(2026, 9, 10, 0, 0))).toBe(true);
  });
});
