// WordPress HTML → Tiptap JSON (P3c): SDK/DOM/UI-মুক্ত pure converter (lib purity)।
// কেন নিজস্ব tokenizer: @tiptap/html ও DOM ছাড়াই node-এ test করা যায়, নতুন dependency লাগে না, এবং
// আউটপুট শুরু থেকেই allowlist-এর ভেতরে (শেষে `sanitizeDoc` defense-in-depth)।
// ছবি: লিংক-placeholder (owner-সিদ্ধান্ত ২০২৬-১০-০৬)। Cleanup শুধু মালিকের আসল XML-এ যা পাওয়া গেছে: Gutenberg/`<!--more-->` comment, wpautop-সমতুল্য (কাঁচা newline),
// inline style/div/span/figure। Shortcode আসল ডেটায় নেই — তাই বানানো হয়নি (Arch §১৭ P3c)।
import { isSafeHref } from "../editor-nodes";
import { sanitizeDoc, type DocMark, type DocNode } from "../editorDoc";

export type ConvertResult = {
  doc: DocNode;
  /** `<img>`-এর src (লেখায় ছবির জায়গায় লিংক-অনুচ্ছেদ বসে; image node P6-এ) */
  images: string[];
  /** বাদ-পড়া/রূপান্তরিত element-এর সংখ্যা, tag-নাম অনুযায়ী */
  dropped: Record<string, number>;
};

type El = { tag: string; attrs: string; kids: Node[] };
type Node = El | string;
type Item = { t: "text"; text: string; marks: DocMark[] } | { t: "br" } | { t: "split" };

const VOID = new Set(["br", "img", "hr", "meta", "link", "input", "wbr", "source"]);
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "form", "noscript", "svg"]);
const CONTAINERS = new Set([
  "div", "section", "article", "figure", "figcaption", "center", "main", "header", "footer", "aside",
  "body", "html", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "dl", "dt", "dd", "pre", "address",
]);
const REPORT_CONTAINERS = new Set(["table", "pre"]); // গঠন হারায় — রিপোর্টে গোনা
const REPORT_FORMATS = new Set(["s", "strike", "del", "code", "sup", "sub", "mark"]);
const ENTITIES: Record<string, string> = {
  nbsp: "\u00a0", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", hellip: "…", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", copy: "©",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(attrs);
  const v = m ? (m[1] ?? m[2] ?? m[3]) : undefined;
  return v === undefined ? undefined : decodeEntities(v);
}

function parse(html: string): El {
  const root: El = { tag: "#root", attrs: "", kids: [] };
  const stack: El[] = [root];
  const top = () => stack[stack.length - 1];
  const tok = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const text = (s: string) => s && top().kids.push(s);
  while ((m = tok.exec(html))) {
    text(html.slice(last, m.index));
    last = tok.lastIndex;
    const tag = m[2].toLowerCase();
    if (m[1]) {
      const i = stack.map((e) => e.tag).lastIndexOf(tag);
      if (i > 0) stack.length = i; // ভুল-নেস্টিং সহ্য: মিল-থাকা পর্যন্ত বন্ধ
      continue;
    }
    // খোলা-না-বন্ধ li/p: নতুনটা আসার আগে আগেরটা বন্ধ
    if (tag === "p" && top().tag === "p") stack.pop();
    if (tag === "li") {
      for (let i = stack.length - 1; i > 0 && !["ul", "ol"].includes(stack[i].tag); i--) {
        if (stack[i].tag === "li") {
          stack.length = i;
          break;
        }
      }
    }
    const el: El = { tag, attrs: m[3].replace(/\/\s*$/, ""), kids: [] };
    top().kids.push(el);
    if (!VOID.has(tag) && !/\/\s*$/.test(m[3])) stack.push(el);
  }
  text(html.slice(last));
  return root;
}

/** ছবির জায়গায় বসানো লিংকের লেখা (P6-র migration এটি খুঁজে image node বানাবে) */
export const IMAGE_LABEL = "🖼 ছবি";
const sameMarks = (a: DocMark[], b: DocMark[]) => JSON.stringify(a) === JSON.stringify(b);

function addText(buf: Item[], raw: string, marks: DocMark[], preserve: boolean, split: boolean) {
  const s = decodeEntities(raw).replace(/\r\n?/g, "\n");
  if (!preserve) {
    const t = s.replace(/[\s\u00a0]+/g, " ");
    if (t) buf.push({ t: "text", text: t, marks });
    return;
  }
  const pushLine = (line: string) => {
    const t = line.replace(/[ \t\u00a0]+/g, " ");
    if (t) buf.push({ t: "text", text: t, marks });
  };
  // preserve (wpautop-সমতুল্য): ফাঁকা-লাইন = অনুচ্ছেদ-ভাগ (শুধু block-স্তরে), একক newline = <br>
  const parts = split ? s.split(/\n[ \t\u00a0]*\n\s*/) : [s];
  parts.forEach((part, pi) => {
    if (pi > 0) buf.push({ t: "split" });
    part.split("\n").forEach((line, li) => {
      if (li > 0) buf.push({ t: "br" });
      pushLine(line);
    });
  });
}

function markFor(tag: string, attrs: string, dropped: Record<string, number>): DocMark | null {
  switch (tag) {
    case "strong":
    case "b":
      return { type: "bold" };
    case "em":
    case "i":
    case "cite":
      return { type: "italic" };
    case "u":
    case "ins":
      return { type: "underline" };
    case "a": {
      const href = attr(attrs, "href");
      if (href === undefined) return null;
      if (isSafeHref(href)) return { type: "link", attrs: { href: href.trim() } };
      if (!href.startsWith("#")) dropped.unsafeLink = (dropped.unsafeLink ?? 0) + 1;
      return null;
    }
    default:
      return null;
  }
}

function paragraphOf(items: Item[]): DocNode | null {
  let it = items.filter((x) => x.t !== "split");
  // শুরু/শেষের <br> ও ফাঁকা বাদ
  const blank = (x: Item) => x.t === "br" || (x.t === "text" && x.text.trim() === "");
  while (it.length && blank(it[0])) it = it.slice(1);
  while (it.length && blank(it[it.length - 1])) it = it.slice(0, -1);
  if (!it.length) return null;
  const nodes: DocNode[] = [];
  let prevBr = true; // শুরুতে/<br>-এর পরে leading space বাদ
  for (const x of it) {
    if (x.t === "br") {
      const last = nodes[nodes.length - 1];
      if (last?.type === "text" && last.text) last.text = last.text.replace(/ +$/, "");
      nodes.push({ type: "hardBreak" });
      prevBr = true;
      continue;
    }
    if (x.t !== "text") continue;
    let text = x.text;
    const last = nodes[nodes.length - 1];
    if (prevBr || (last?.type === "text" && last.text?.endsWith(" "))) text = text.replace(/^ +/, "");
    if (!text) continue;
    prevBr = false;
    if (last?.type === "text" && sameMarks(last.marks ?? [], x.marks)) last.text += text;
    else nodes.push(x.marks.length ? { type: "text", text, marks: x.marks } : { type: "text", text });
  }
  const tail = nodes[nodes.length - 1];
  if (tail?.type === "text" && tail.text) tail.text = tail.text.replace(/ +$/, "");
  const cleaned = nodes.filter((n) => n.type !== "text" || n.text);
  return cleaned.some((n) => n.type === "text") ? { type: "paragraph", content: cleaned } : null;
}

function emitParas(buf: Item[], out: DocNode[]) {
  let group: Item[] = [];
  const flush = () => {
    const p = paragraphOf(group);
    if (p) out.push(p);
    group = [];
  };
  for (const x of buf) {
    if (x.t === "split") flush();
    else group.push(x);
  }
  flush();
}

export function htmlToDoc(raw: string): ConvertResult {
  const images: string[] = [];
  const dropped: Record<string, number> = {};
  const count = (k: string) => void (dropped[k] = (dropped[k] ?? 0) + 1);
  // Gutenberg block-comment থাকলে wpautop প্রযোজ্য নয় (newline = সাধারণ ফাঁকা)
  const preserve = !/<!--\s*wp:/i.test(raw);
  const root = parse(raw.replace(/<!--[\s\S]*?-->/g, ""));

  function inline(nodes: Node[], marks: DocMark[], buf: Item[], split: boolean) {
    for (const n of nodes) {
      if (typeof n === "string") {
        addText(buf, n, marks, preserve, split);
        continue;
      }
      const tag = n.tag;
      if (tag === "br") buf.push({ t: "br" });
      else if (tag === "img") {
        // এডিটরে image node P6 পর্যন্ত নেই: ছবির জায়গায় মূল URL-এর লিংক বসে (অবস্থান ও URL হারায় না; P6-এ খুঁজে বদলানো যাবে)
        count("img");
        const src = attr(n.attrs, "src")?.trim();
        if (src) {
          images.push(src);
          if (isSafeHref(src)) buf.push({ t: "text", text: IMAGE_LABEL, marks: [{ type: "link", attrs: { href: src } }] });
        }
      } else if (DROP_WITH_CONTENT.has(tag)) count(tag);
      else {
        if (REPORT_FORMATS.has(tag)) count(tag);
        const mk = markFor(tag, n.attrs, dropped);
        inline(n.kids, mk && !marks.some((m) => m.type === mk.type) ? [...marks, mk] : marks, buf, split);
      }
    }
  }

  function blocks(nodes: Node[]): DocNode[] {
    const out: DocNode[] = [];
    let buf: Item[] = [];
    const flush = () => {
      emitParas(buf, out);
      buf = [];
    };
    for (const n of nodes) {
      if (typeof n === "string") {
        addText(buf, n, [], preserve, true);
        continue;
      }
      const tag = n.tag;
      if (tag === "p") {
        flush();
        const b: Item[] = [];
        inline(n.kids, [], b, false);
        emitParas(b, out);
      } else if (/^h[1-6]$/.test(tag)) {
        flush();
        const b: Item[] = [];
        inline(n.kids, [], b, false);
        const p = paragraphOf(b);
        if (p?.content) out.push({ type: "heading", attrs: { level: Number(tag[1]) <= 2 ? 2 : 3 }, content: p.content });
      } else if (tag === "ul" || tag === "ol") {
        flush();
        const items: DocNode[] = [];
        for (const k of n.kids) {
          if (typeof k === "string" || k.tag !== "li") continue;
          const c = blocks(k.kids);
          if (!c.length) continue;
          if (c[0].type !== "paragraph") c.unshift({ type: "paragraph" }); // listItem = paragraph block*
          items.push({ type: "listItem", content: c });
        }
        if (items.length) {
          const start = Number(attr(n.attrs, "start"));
          out.push(
            tag === "ol"
              ? { type: "orderedList", attrs: { start: Number.isInteger(start) && start > 0 ? start : 1 }, content: items }
              : { type: "bulletList", content: items },
          );
        }
      } else if (tag === "blockquote") {
        flush();
        const c = blocks(n.kids);
        if (c.length) out.push({ type: "blockquote", content: c });
      } else if (tag === "hr") {
        flush();
        out.push({ type: "horizontalRule" });
      } else if (CONTAINERS.has(tag)) {
        flush();
        if (REPORT_CONTAINERS.has(tag)) count(tag);
        out.push(...blocks(n.kids));
      } else inline([n], [], buf, true); // inline বা অজানা tag: স্বচ্ছ, টেক্সট থাকে
    }
    flush();
    return out;
  }

  const content = blocks(root.kids);
  const doc = sanitizeDoc({ type: "doc", content: content.length ? content : [{ type: "paragraph" }] });
  return { doc, images, dropped };
}
