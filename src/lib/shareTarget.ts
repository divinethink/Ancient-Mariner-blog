// Web Share Target (GET) → Inbox নোট (P7b-৩; Mockup §৭.১৯)। pure: params থেকে শিরোনাম/লেখা বের করা।
import { IDEA_TITLE_MAX, NOTE_CONTENT_MAX } from "./idea";

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? "";

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut; // অর্ধেক surrogate বাদ
}

export function parseShare(params: Params): { title: string; content: string } {
  let title = first(params.title).trim();
  const text = first(params.text).trim();
  const url = first(params.url).trim();
  // Android প্রায়ই লিংক `text`-এর ভেতরেই দেয়; আলাদা এলে শেষে যোগ
  let content = [text, url && !text.includes(url) ? url : ""].filter(Boolean).join("\n");
  if (!content) {
    content = title; // শুধু শিরোনাম এলে সেটাই নোটের লেখা
    title = "";
  }
  return { title: clip(title, IDEA_TITLE_MAX), content: clip(content, NOTE_CONTENT_MAX) };
}
