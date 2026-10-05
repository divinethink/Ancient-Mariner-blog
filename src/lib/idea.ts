// Ideas/Inbox-এর pure যুক্তি (SDK/UI-মুক্ত; P3b): সীমা, text-normalize, idea → লেখার খসড়া।
import { countWords, makeExcerpt, serializeDoc, type DocNode } from "./editorDoc";

export const IDEA_TEXT_MAX = 2000;
export const IDEA_TITLE_MAX = 120;
export const NOTE_CONTENT_MAX = 5000;
export const IDEAS_PAGE = 50;

/** CRLF → LF; প্রান্তের ফাঁকা বাদ (ভেতরের লাইন-ভাঙা অক্ষত) */
export const cleanText = (s: string): string => s.replace(/\r\n?/g, "\n").trim();

/** খালি লাইনে অনুচ্ছেদ ভাগ; অনুচ্ছেদের ভেতরের একক newline = হার্ড-ব্রেক */
export function textToDoc(text: string): DocNode {
  const paras = cleanText(text)
    .split(/\n{2,}/u)
    .map((p) => p.trim())
    .filter((p) => p !== "");
  if (paras.length === 0) return { type: "doc", content: [{ type: "paragraph" }] };
  return {
    type: "doc",
    content: paras.map((p) => {
      const content: DocNode[] = [];
      p.split("\n").forEach((line, i) => {
        if (i > 0) content.push({ type: "hardBreak" });
        if (line !== "") content.push({ type: "text", text: line });
      });
      return content.length ? { type: "paragraph", content } : { type: "paragraph" };
    }),
  };
}

export type PostDraftSeed = { title: string; body: string; excerpt: string; wordCount: number };

/** আইডিয়া → নতুন লেখার বীজ: শিরোনাম ঐচ্ছিক (খালি থাকলে খালি; editor শিরোনামহীন লেখা সামলায়) */
export function ideaToPostSeed(idea: { title?: string; text: string }): PostDraftSeed {
  const text = cleanText(idea.text);
  return {
    title: (idea.title ?? "").trim(),
    body: serializeDoc(textToDoc(text)),
    excerpt: makeExcerpt(text),
    wordCount: countWords(text),
  };
}
