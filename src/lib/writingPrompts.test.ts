import { describe, expect, it } from "vitest";
import { PROMPT_TYPES, WRITING_PROMPTS, writingPromptFor } from "./writingPrompts";

describe("writingPromptFor", () => {
  it("একই ধরন/দিন/shift-এ একই; পরের দিনে আলাদা", () => {
    expect(writingPromptFor("story", "2026-10-23")).toBe(writingPromptFor("story", "2026-10-23"));
    expect(writingPromptFor("story", "2026-10-23")).not.toBe(writingPromptFor("story", "2026-10-24"));
  });
  it("shift ঘুরে আসে ও অবৈধ ইনপুটে ভাঙে না", () => {
    for (const t of PROMPT_TYPES) {
      const n = WRITING_PROMPTS[t].length;
      expect(writingPromptFor(t, "2026-10-23", n)).toBe(writingPromptFor(t, "2026-10-23"));
      expect(WRITING_PROMPTS[t]).toContain(writingPromptFor(t, "bad", -5.5));
    }
  });
  it("প্রতি ধরনে ≥৫টা, সব অনন্য ও খালি নয়", () => {
    for (const t of PROMPT_TYPES) {
      const l = WRITING_PROMPTS[t];
      expect(l.length).toBeGreaterThanOrEqual(5);
      expect(new Set(l).size).toBe(l.length);
      expect(l.every((p) => p.trim().length > 0)).toBe(true);
    }
  });
});
