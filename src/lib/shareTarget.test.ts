import { describe, expect, it } from "vitest";
import { IDEA_TITLE_MAX, NOTE_CONTENT_MAX } from "./idea";
import { parseShare } from "./shareTarget";

describe("parseShare", () => {
  it("title+text+url আলাদা এলে লেখা = text + url", () => {
    expect(parseShare({ title: " T ", text: "লেখা", url: "https://a.b/c" })).toEqual({
      title: "T",
      content: "লেখা\nhttps://a.b/c",
    });
  });
  it("url যদি text-এর ভেতরেই থাকে, দ্বিগুণ হয় না", () => {
    expect(parseShare({ text: "দেখো https://a.b/c", url: "https://a.b/c" }).content).toBe(
      "দেখো https://a.b/c",
    );
  });
  it("শুধু title এলে সেটাই লেখা, শিরোনাম খালি", () => {
    expect(parseShare({ title: "শুধু শিরোনাম" })).toEqual({ title: "", content: "শুধু শিরোনাম" });
  });
  it("কিছু না এলে খালি; array মানে প্রথমটা", () => {
    expect(parseShare({})).toEqual({ title: "", content: "" });
    expect(parseShare({ text: ["এক", "দুই"] }).content).toBe("এক");
  });
  it("সীমা ছাড়ালে ছাঁটে, surrogate ভাঙে না", () => {
    const r = parseShare({ title: "x".repeat(500), text: "😀".repeat(NOTE_CONTENT_MAX) });
    expect(r.title.length).toBe(IDEA_TITLE_MAX);
    expect(r.content.length).toBeLessThanOrEqual(NOTE_CONTENT_MAX);
    expect(r.content.endsWith("😀")).toBe(true);
  });
});
