import { describe, expect, it } from "vitest";
import { cleanText, ideaToPostSeed, textToDoc } from "./idea";
import { docToText, parseBody } from "./editorDoc";

describe("cleanText", () => {
  it("CRLF → LF ও প্রান্ত ছাঁটা", () => {
    expect(cleanText("  ক\r\nখ \r\n")).toBe("ক\nখ");
  });
});

describe("textToDoc", () => {
  it("খালি লাইনে অনুচ্ছেদ, একক newline = hardBreak", () => {
    const d = textToDoc("প্রথম\nদ্বিতীয়\n\n\nতৃতীয়");
    expect(d.content).toHaveLength(2);
    expect(d.content?.[0].content?.map((n) => n.type)).toEqual(["text", "hardBreak", "text"]);
    expect(docToText(d)).toBe("প্রথম\nদ্বিতীয়\nতৃতীয়");
  });
  it("খালি টেক্সটে একটা ফাঁকা অনুচ্ছেদ", () => {
    expect(textToDoc("  \n ").content).toEqual([{ type: "paragraph" }]);
  });
});

describe("ideaToPostSeed", () => {
  it("শিরোনাম, allowlist-মানা body, excerpt ও শব্দ-সংখ্যা", () => {
    const s = ideaToPostSeed({ title: " জোনাক ", text: "রাতের আকাশে\nজোনাকির আলো" });
    expect(s.title).toBe("জোনাক");
    expect(s.wordCount).toBe(4);
    expect(s.excerpt).toBe("রাতের আকাশে জোনাকির আলো");
    expect(docToText(parseBody(s.body))).toBe("রাতের আকাশে\nজোনাকির আলো");
  });
  it("শিরোনাম না থাকলে খালি; দীর্ঘ লেখায় excerpt ছাঁটা", () => {
    const s = ideaToPostSeed({ text: "ক".repeat(400) });
    expect(s.title).toBe("");
    expect(Array.from(s.excerpt).length).toBeLessThanOrEqual(161);
  });
});
