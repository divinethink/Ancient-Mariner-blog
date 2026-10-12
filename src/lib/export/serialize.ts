// লেখা কপির serializer (P7b-২): Tiptap doc → সাধারণ টেক্সট / Markdown। pure; শুধু allowlist node/mark (lib/editor-nodes)।
import type { DocNode } from "../editorDoc";
import { isSafeMediaId } from "../editor-nodes";
import { imageAlt, imageCaption, imagePlaceholder } from "../imageText";

type Mode = "plain" | "md";

// শিরোনাম-স্তর সরানোর (P13b: সংগ্রহ-ফাইলে লেখার ভেতরের H2/H3 যেন ক্যাটাগরি/লেখার শিরোনামের নিচে থাকে); ডিফল্ট ০ = আগের আচরণ
let headingShift = 0;

// ছবি (P6-গ২): ডিফল্টে ছবি বাদ (খোঁজ-index অপরিবর্তিত); `images` চালু হলে — Markdown-এ url মিললে `![alt](url)` + ক্যাপশন, নইলে (এবং সাধারণ টেক্সটে) `[ছবি: …]`।
export type MediaUrlFn = (mediaId: string) => string | undefined;
export type SerializeOpts = { images?: boolean; mediaUrl?: MediaUrlFn };
let imagesOn = false;
let mediaUrlFn: MediaUrlFn | undefined;

export const mdEscape = (s: string) => s.replace(/([\\`*_[\]])/g, "\\$1");

function inline(n: DocNode, mode: Mode): string {
  if (n.type === "hardBreak") return mode === "md" ? "  \n" : "\n";
  if (n.type !== "text" || !n.text) return "";
  if (mode === "plain") return n.text;
  let t = mdEscape(n.text);
  const has = (m: string) => n.marks?.some((x) => x.type === m);
  if (has("bold")) t = `**${t}**`;
  if (has("italic")) t = `*${t}*`;
  if (has("underline")) t = `<u>${t}</u>`; // Markdown-এ underline নেই — inline HTML
  const link = n.marks?.find((x) => x.type === "link");
  const href = link && typeof link.attrs?.href === "string" ? link.attrs.href : "";
  if (href) t = `[${t}](${href.replace(/\)/g, "%29")})`;
  return t;
}

const inlineText = (n: DocNode, mode: Mode) =>
  (n.content ?? []).map((c) => inline(c, mode)).join("");

function block(n: DocNode, mode: Mode, quote: boolean): string[] {
  const kids = n.content ?? [];
  switch (n.type) {
    case "paragraph":
      return [inlineText(n, mode)];
    case "heading": {
      const level = Math.min(6, (Number(n.attrs?.level) === 3 ? 3 : 2) + headingShift);
      return [mode === "md" ? `${"#".repeat(level)} ${inlineText(n, mode)}` : inlineText(n, mode)];
    }
    case "horizontalRule":
      return [mode === "md" ? "---" : "* * *"];
    case "blockquote": {
      const inner = blocks(kids, mode, true).join("\n").split("\n");
      return [mode === "md" ? inner.map((l) => (l ? `> ${l}` : ">")).join("\n") : inner.join("\n")];
    }
    case "bulletList":
    case "orderedList": {
      const start =
        n.type === "orderedList" && Number.isInteger(n.attrs?.start)
          ? (n.attrs?.start as number)
          : 1;
      return [
        kids
          .map((li, i) => {
            const mark = n.type === "orderedList" ? `${start + i}.` : mode === "md" ? "-" : "•";
            const body = blocks(li.content ?? [], mode, quote)
              .join("\n")
              .split("\n");
            const pad = " ".repeat(mark.length + 1);
            return body.map((l, j) => (j === 0 ? `${mark} ${l}` : l ? `${pad}${l}` : l)).join("\n");
          })
          .join("\n"),
      ];
    }
    case "mediaImage": {
      if (!imagesOn) return [];
      if (mode === "plain") return [imagePlaceholder(n.attrs)];
      const id = typeof n.attrs?.mediaId === "string" ? n.attrs.mediaId : "";
      const url = isSafeMediaId(id) ? mediaUrlFn?.(id) : undefined;
      if (url && /^https:\/\//.test(url)) {
        const cap = imageCaption(n.attrs);
        const img = `![${mdEscape(imageAlt(n.attrs))}](${url.replace(/[()\s]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`)})`;
        return cap ? [img, `*${mdEscape(cap)}*`] : [img];
      }
      return [mdEscape(imagePlaceholder(n.attrs))];
    }
    default:
      return [];
  }
}

function blocks(nodes: DocNode[], mode: Mode, quote: boolean): string[] {
  return nodes.flatMap((n) => block(n, mode, quote));
}

/** ব্লকগুলোর মাঝে একটা ফাঁকা লাইন; শেষে একটা newline; খালি doc → "" */
export function serializeDoc(doc: DocNode, mode: Mode, opts: SerializeOpts = {}): string {
  const prev = [imagesOn, mediaUrlFn] as const;
  imagesOn = opts.images === true;
  mediaUrlFn = opts.mediaUrl;
  try {
    const out = blocks(doc.content ?? [], mode, false)
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return out ? `${out}\n` : "";
  } finally {
    [imagesOn, mediaUrlFn] = prev;
  }
}

/** Markdown, শিরোনাম-স্তর `shift` ধাপ নিচে (শুধু সংগ্রহ-এক্সপোর্টে); ছবি = `[ছবি: …]` (self-contained ফাইল) */
export function serializeDocShifted(doc: DocNode, shift: number): string {
  headingShift = Math.max(0, Math.min(4, Math.trunc(shift)));
  try {
    return serializeDoc(doc, "md", { images: true });
  } finally {
    headingShift = 0;
  }
}

/** শিরোনামসহ কপির টেক্সট; শিরোনাম থাকলে Markdown-এ `# `, সাধারণে প্রথম লাইন; ছবি অন্তর্ভুক্ত */
export function serializePost(title: string, doc: DocNode, mode: Mode, opts: Pick<SerializeOpts, "mediaUrl"> = {}): string {
  const t = title.trim();
  const body = serializeDoc(doc, mode, { images: true, mediaUrl: opts.mediaUrl });
  if (!t) return body;
  const head = mode === "md" ? `# ${mdEscape(t)}` : t;
  return body ? `${head}\n\n${body}` : `${head}\n`;
}
