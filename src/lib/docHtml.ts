// Tiptap doc → HTML string (pure; শুধু RSS-এর জন্য — পাবলিক পেজ allowlist React-renderer-ই ব্যবহার করে, Arch §১৪.১)।
// ইনপুট `parseBody`-এ sanitize-করা (allowlist-বহির্ভূত node/mark/অনিরাপদ লিংক বাদ); এখানে টেক্সট/attr আবার escape ও লিংক আবার যাচাই।
import { isSafeHref } from "./editor-nodes";
import { imagePlaceholder } from "./imageText";
import { parseBody, type DocMark, type DocNode } from "./editorDoc";

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function marked(text: string, marks: DocMark[] | undefined): string {
  let out = escapeHtml(text);
  for (const m of marks ?? []) {
    if (m.type === "bold") out = `<strong>${out}</strong>`;
    else if (m.type === "italic") out = `<em>${out}</em>`;
    else if (m.type === "underline") out = `<u>${out}</u>`;
    else if (m.type === "link") {
      const href = m.attrs?.href;
      if (typeof href === "string" && isSafeHref(href)) {
        out = `<a href="${escapeHtml(href.trim())}" rel="noopener noreferrer">${out}</a>`;
      }
    }
  }
  return out;
}

const kids = (n: DocNode, ph: boolean): string => (n.content ?? []).map((c) => node(c, ph)).join("");

function node(n: DocNode, ph: boolean): string {
  switch (n.type) {
    case "text":
      return marked(n.text ?? "", n.marks);
    case "paragraph":
      return `<p>${kids(n, ph)}</p>`;
    case "heading": {
      const t = Number(n.attrs?.level) === 3 ? "h3" : "h2";
      return `<${t}>${kids(n, ph)}</${t}>`;
    }
    case "bulletList":
      return `<ul>${kids(n, ph)}</ul>`;
    case "orderedList": {
      const start = Number(n.attrs?.start);
      return `<ol${Number.isInteger(start) && start > 1 ? ` start="${start}"` : ""}>${kids(n, ph)}</ol>`;
    }
    case "listItem":
      return `<li>${kids(n, ph)}</li>`;
    case "blockquote":
      return `<blockquote>${kids(n, ph)}</blockquote>`;
    case "horizontalRule":
      return "<hr/>";
    case "hardBreak":
      return "<br/>";
    case "mediaImage":
      return ph ? `<p class="img-ph">${escapeHtml(imagePlaceholder(n.attrs))}</p>` : ""; // ছবি embed নয় — শুধু টেক্সট-স্থানধারক
    default:
      return ""; // allowlist-বহির্ভূত node — কিছুই নয়
  }
}

/** সংরক্ষিত body-string → নিরাপদ HTML; বিকৃত/খালি হলে ""। `imagePlaceholders` শুধু self-contained export-এ (RSS-এ নয়) */
export function bodyToHtml(body: string, opts: { imagePlaceholders?: boolean } = {}): string {
  const doc = parseBody(body);
  return doc.type === "doc" ? kids(doc, opts.imagePlaceholders === true) : "";
}
