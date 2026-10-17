// Tiptap JSON-এর pure সহায়ক (SDK/UI-মুক্ত): parse, allowlist-sanitize, plain-text, শব্দ-গণনা, excerpt।
// body সংরক্ষিত হয় JSON.stringify-করা string হিসেবে (Arch §৬)।
import {
  ALLOWED_MARKS,
  ALLOWED_NODES,
  HEADING_LEVELS,
  isImageAlign,
  isImageSize,
  isSafeHref,
  isTextAlign,
  isSafeMediaId,
  MEDIA_ALT_MAX,
  MEDIA_CAPTION_MAX,
} from "./editor-nodes";

export type DocMark = { type: string; attrs?: Record<string, unknown> };
export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: DocMark[];
  text?: string;
};

export const EMPTY_DOC: DocNode = { type: "doc", content: [{ type: "paragraph" }] };
export const EMPTY_BODY = JSON.stringify(EMPTY_DOC);

const NODES = new Set<string>(ALLOWED_NODES);
const MARKS = new Set<string>(ALLOWED_MARKS);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function cleanMarks(marks: unknown): DocMark[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const out: DocMark[] = [];
  for (const m of marks) {
    if (!isObj(m) || typeof m.type !== "string" || !MARKS.has(m.type)) continue;
    if (m.type === "link") {
      const href = isObj(m.attrs) ? m.attrs.href : undefined;
      if (typeof href !== "string" || !isSafeHref(href)) continue; // অনিরাপদ লিংক-mark বাদ, টেক্সট থাকে
      out.push({ type: "link", attrs: { href: href.trim() } });
    } else out.push({ type: m.type });
  }
  return out.length ? out : undefined;
}

const clip = (v: unknown, max: number): string => (typeof v === "string" ? Array.from(v.trim()).slice(0, max).join("") : "");

function cleanNode(n: unknown): DocNode | null {
  if (!isObj(n) || typeof n.type !== "string" || !NODES.has(n.type)) return null;
  if (n.type === "text") {
    if (typeof n.text !== "string" || n.text === "") return null;
    const marks = cleanMarks(n.marks);
    return marks ? { type: "text", text: n.text, marks } : { type: "text", text: n.text };
  }
  if (n.type === "mediaImage") {
    // leaf node: শুধু mediaId (+alt/caption)। অবৈধ id ⇒ node বাদ; raw src/url ইত্যাদি attr ঝরে যায়
    const a = isObj(n.attrs) ? n.attrs : {};
    if (!isSafeMediaId(a.mediaId)) return null;
    const caption = clip(a.caption, MEDIA_CAPTION_MAX);
    return {
      type: "mediaImage",
      attrs: {
        mediaId: a.mediaId,
        alt: clip(a.alt, MEDIA_ALT_MAX),
        ...(caption ? { caption } : {}),
        ...(isImageSize(a.size) ? { size: a.size } : {}),
        ...(isImageAlign(a.align) ? { align: a.align } : {}),
      },
    };
  }
  const out: DocNode = { type: n.type };
  if (n.type === "heading") {
    const level = isObj(n.attrs) ? Number(n.attrs.level) : NaN;
    out.attrs = { level: (HEADING_LEVELS as readonly number[]).includes(level) ? level : 2 };
  }
  if (n.type === "paragraph" || n.type === "heading") {
    const ta = isObj(n.attrs) ? n.attrs.textAlign : undefined;
    if (isTextAlign(ta)) out.attrs = { ...(out.attrs ?? {}), textAlign: ta };
  }
  if (n.type === "orderedList") {
    const start = isObj(n.attrs) ? Number(n.attrs.start) : 1;
    out.attrs = { start: Number.isInteger(start) && start > 0 ? start : 1 };
  }
  if (Array.isArray(n.content)) {
    const kids = n.content.map(cleanNode).filter((k): k is DocNode => k !== null);
    if (kids.length) out.content = kids;
  }
  return out;
}

/** allowlist-বহির্ভূত node/mark/অনিরাপদ লিংক বাদ (defense-in-depth; editor-schema আগেই আটকায়) */
export function sanitizeDoc(input: unknown): DocNode {
  const doc = cleanNode(input);
  if (!doc || doc.type !== "doc") return EMPTY_DOC;
  return doc.content?.length ? doc : EMPTY_DOC;
}

/** সংরক্ষিত body-string → নিরাপদ doc; বিকৃত/খালি হলে EMPTY_DOC */
export function parseBody(body: string): DocNode {
  try {
    return sanitizeDoc(JSON.parse(body));
  } catch {
    return EMPTY_DOC;
  }
}

export const serializeDoc = (doc: unknown): string => JSON.stringify(sanitizeDoc(doc));

/** body-র সব mediaImage-এর id (ডুপ্লিকেট ছাড়া, ক্রম বজায়) — build-এ public media আনতে */
export function collectMediaIds(doc: DocNode): string[] {
  const out = new Set<string>();
  const walk = (n: DocNode) => {
    if (n.type === "mediaImage" && typeof n.attrs?.mediaId === "string") out.add(n.attrs.mediaId);
    n.content?.forEach(walk);
  };
  walk(doc);
  return [...out];
}

const BLOCKS = new Set(["paragraph", "heading", "listItem", "blockquote", "horizontalRule"]);

export function docToText(doc: DocNode): string {
  const parts: string[] = [];
  const walk = (n: DocNode) => {
    if (n.type === "text") parts.push(n.text ?? "");
    else if (n.type === "hardBreak") parts.push("\n");
    n.content?.forEach(walk);
    if (BLOCKS.has(n.type)) parts.push("\n");
  };
  walk(doc);
  return parts.join("").replace(/\n{2,}/g, "\n").trim();
}

/** বাংলা/ইংরেজি দুটোতেই কাজ করা সরল হিসাব: ফাঁকা-ভাগ করা শব্দ */
export function countWords(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/u).length;
}

export function makeExcerpt(text: string, max = 160): string {
  const flat = text.replace(/\s+/gu, " ").trim();
  const chars = Array.from(flat);
  return chars.length <= max ? flat : chars.slice(0, max).join("").trimEnd() + "…";
}
