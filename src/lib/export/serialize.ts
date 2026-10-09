// লেখা কপির serializer (P7b-২): Tiptap doc → সাধারণ টেক্সট / Markdown। pure; শুধু allowlist node/mark (lib/editor-nodes)।
import type { DocNode } from "../editorDoc";

type Mode = "plain" | "md";

const mdEscape = (s: string) => s.replace(/([\\`*_[\]])/g, "\\$1");

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
      const level = Number(n.attrs?.level) === 3 ? 3 : 2;
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
    default:
      return [];
  }
}

function blocks(nodes: DocNode[], mode: Mode, quote: boolean): string[] {
  return nodes.flatMap((n) => block(n, mode, quote));
}

/** ব্লকগুলোর মাঝে একটা ফাঁকা লাইন; শেষে একটা newline; খালি doc → "" */
export function serializeDoc(doc: DocNode, mode: Mode): string {
  const out = blocks(doc.content ?? [], mode, false)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out ? `${out}\n` : "";
}

/** শিরোনামসহ কপির টেক্সট; শিরোনাম থাকলে Markdown-এ `# `, সাধারণে প্রথম লাইন */
export function serializePost(title: string, doc: DocNode, mode: Mode): string {
  const t = title.trim();
  const body = serializeDoc(doc, mode);
  if (!t) return body;
  const head = mode === "md" ? `# ${mdEscape(t)}` : t;
  return body ? `${head}\n\n${body}` : `${head}\n`;
}
