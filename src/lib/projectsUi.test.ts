import { describe, expect, it } from "vitest";
import { canChapterBePublic, chapterPath, newChapterPath, projectPath } from "./projectsUi";

describe("projectsUi", () => {
  it("পথ", () => {
    expect(projectPath("abc")).toBe("/dashboard/projects/abc");
    expect(chapterPath("abc", "x1")).toBe("/dashboard/projects/abc/chapters/x1");
    expect(newChapterPath("abc", "x1")).toBe("/dashboard/projects/abc/chapters/x1?new=1");
  });
  it("প্রজেক্ট private/অজানা হলে অধ্যায় Public নয়", () => {
    expect(canChapterBePublic("public")).toBe(true);
    expect(canChapterBePublic("private")).toBe(false);
    expect(canChapterBePublic("")).toBe(false);
  });
});
