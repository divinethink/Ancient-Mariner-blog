// পড়ার পাতার স্বয়ংক্রিয় সূচি (TOC) — Tiptap doc-এর heading থেকে (Arch §১৭ P10b-১)। pure, SDK/UI-মুক্ত।
// id ক্রমভিত্তিক ASCII (`h-1…`): বাংলা heading-টেক্সট থেকে anchor বানালে সংঘাত/encoding ঝামেলা। renderer (`PostBody`) একই DFS-ক্রমে একই id বসায়।
import { docToText, type DocNode } from "./editorDoc";

export const TOC_MIN_HEADINGS = 3;
export const headingId = (n: number): string => `h-${n}`;

export type TocItem = { id: string; text: string; level: 2 | 3 };

/** doc-এর heading (গভীরতা-প্রথম ক্রমে); `min`টার কম হলে খালি (ছোট লেখায় সূচি অপ্রয়োজনীয়); খালি-টেক্সট heading বাদ কিন্তু id-ক্রম গোনে */
export function buildToc(doc: DocNode, min = TOC_MIN_HEADINGS): TocItem[] {
  const out: TocItem[] = [];
  let n = 0;
  const walk = (node: DocNode) => {
    if (node.type === "heading") {
      n++;
      const text = docToText(node).replace(/\s+/g, " ").trim();
      if (text) out.push({ id: headingId(n), text, level: Number(node.attrs?.level) === 3 ? 3 : 2 });
    }
    for (const c of node.content ?? []) walk(c);
  };
  walk(doc);
  return out.length >= min ? out : [];
}
