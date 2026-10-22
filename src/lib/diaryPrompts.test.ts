import { describe, expect, it } from "vitest";
import { DIARY_PROMPTS, promptFor } from "./diaryPrompts";

describe("promptFor", () => {
  it("একই দিন ও shift-এ একই প্রশ্ন; পরের দিনে আলাদা", () => {
    expect(promptFor("2026-10-22")).toBe(promptFor("2026-10-22"));
    expect(promptFor("2026-10-22")).not.toBe(promptFor("2026-10-23"));
  });
  it("shift ঘুরে আসে (তালিকার দৈর্ঘ্যে) ও ঋণাত্মক/অবৈধ ইনপুটে ভাঙে না", () => {
    expect(promptFor("2026-10-22", DIARY_PROMPTS.length)).toBe(promptFor("2026-10-22"));
    expect(DIARY_PROMPTS).toContain(promptFor("2026-10-22", -3));
    expect(DIARY_PROMPTS).toContain(promptFor("bad", 1.7));
  });
  it("প্রশ্নগুলো অনন্য ও ফাঁকা নয়", () => {
    expect(new Set(DIARY_PROMPTS).size).toBe(DIARY_PROMPTS.length);
    expect(DIARY_PROMPTS.every((p) => p.trim().length > 0)).toBe(true);
  });
});
