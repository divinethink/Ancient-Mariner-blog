// Tiptap JSON → React, allowlist-renderer (Arch §১৪.১)। `.ts` + createElement ইচ্ছাকৃত: Vitest-এ JSX transform (tsconfig `jsx: preserve`) এড়াতে,
// যাতে প্রতিটা node/mark-এর allowed-vs-blocked unit-test CI-তে চলে। node/mark-তালিকার উৎস `lib/editor-nodes.ts`।
// HTML কখনো string থেকে বসে না (dangerouslySetInnerHTML নেই); টেক্সট React escape করে।
import { createElement as h, Fragment, type ReactNode } from "react";
import { isSafeHref } from "@/lib/editor-nodes";
import { headingId } from "@/lib/toc";
import { parseBody, type DocMark, type DocNode } from "@/lib/editorDoc";

function applyMarks(text: string, marks: DocMark[] | undefined): ReactNode {
  let out: ReactNode = text;
  for (const m of marks ?? []) {
    if (m.type === "bold") out = h("strong", null, out);
    else if (m.type === "italic") out = h("em", null, out);
    else if (m.type === "underline") out = h("u", null, out);
    else if (m.type === "link") {
      const href = m.attrs?.href;
      // renderer-এও আবার যাচাই (sanitize-এর পরেও defense-in-depth); অনিরাপদ হলে শুধু টেক্সট
      if (typeof href === "string" && isSafeHref(href)) {
        out = h("a", { href: href.trim(), rel: "noopener noreferrer" }, out);
      }
    } // অন্য mark: বাদ, টেক্সট থাকে
  }
  return out;
}

/** anchors চালু হলে heading-গুলো ক্রমানুসারে `h-1, h-2…` id পায় (TOC-র `lib/toc` একই DFS-ক্রম); নইলে id নেই */
type State = { anchors: boolean; n: number };

function kids(n: DocNode, st: State): ReactNode[] {
  return (n.content ?? []).map((c, i) => renderNode(c, i, st));
}

function renderNode(n: DocNode, key: number, st: State): ReactNode {
  switch (n.type) {
    case "text":
      return h(Fragment, { key }, applyMarks(n.text ?? "", n.marks));
    case "paragraph":
      return h("p", { key }, ...kids(n, st));
    case "heading": // H1 = শিরোনাম; body-তে শুধু H2–H3
    {
      const id = st.anchors ? headingId(++st.n) : undefined;
      return h(Number(n.attrs?.level) === 3 ? "h3" : "h2", { key, ...(id && { id }) }, ...kids(n, st));
    }
    case "bulletList":
      return h("ul", { key }, ...kids(n, st));
    case "orderedList": {
      const start = Number(n.attrs?.start);
      return h("ol", { key, ...(Number.isInteger(start) && start > 1 ? { start } : {}) }, ...kids(n, st));
    }
    case "listItem":
      return h("li", { key }, ...kids(n, st));
    case "blockquote":
      return h("blockquote", { key }, ...kids(n, st));
    case "horizontalRule":
      return h("hr", { key });
    case "hardBreak":
      return h("br", { key });
    default:
      return null; // allowlist-বহির্ভূত node (image/iframe/script/…) — কিছুই render হয় না
  }
}

/** doc যেমন আছে তেমন render (কোনো sanitize ছাড়া) — renderer-এর নিজস্ব allowlist-test-এর জন্য আলাদা export */
export function DocView({ doc, anchors = false }: { doc: DocNode; anchors?: boolean }): ReactNode {
  if (doc.type !== "doc") return null;
  return h(Fragment, null, ...kids(doc, { anchors, n: 0 }));
}

/** সংরক্ষিত body-string → `parseBody` (sanitize) → render */
export function PostBody({ body, anchors = false }: { body: string; anchors?: boolean }): ReactNode {
  return h(DocView, { doc: parseBody(body), anchors });
}
