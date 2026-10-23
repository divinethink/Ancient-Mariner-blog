import { describe, expect, it } from "vitest";
import { DAILY_TASKS, dailyTaskFor } from "./dailyTask";

describe("dailyTaskFor", () => {
  it("একই দিনে একই; টানা ক'দিনে সব কাজ ঘোরে", () => {
    expect(dailyTaskFor("2026-10-23").id).toBe(dailyTaskFor("2026-10-23").id);
    const ids = new Set(["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"].map((d) => dailyTaskFor(d).id));
    expect(ids.size).toBe(DAILY_TASKS.length);
  });
  it("অবৈধ key-তে ভাঙে না ও href /dashboard-এর ভেতরে", () => {
    expect(dailyTaskFor("bad").href.startsWith("/dashboard")).toBe(true);
    expect(DAILY_TASKS.every((t) => t.href.startsWith("/dashboard/"))).toBe(true);
  });
});
