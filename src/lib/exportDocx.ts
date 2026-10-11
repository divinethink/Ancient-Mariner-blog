// P13c: লেখা → Word (.docx) — ব্রাউজারে তৈরি, শুধু read। `docx` প্যাকেজ lazy import (প্রথম লোডে ঢোকে না)।
// ক্যাটাগরি = Heading 1, লেখা = Heading 2, লেখার ভেতরের শিরোনাম = Heading 3/4। শুধু allowlist node/mark (parseBody-তে sanitize), লিংক শুধু http/https/mailto (isSafeHref)।
// বাংলা: complex-script ফন্ট (w:cs) + ভাষা bn-BD + boldCs/italicsCs/szCs — নইলে Word-এ বাংলা bold/size ঠিক হয় না।
import type { Paragraph } from "docx";
import { formatDate } from "./datetime";
import { isSafeHref } from "./editor-nodes";
import { parseBody, type DocNode } from "./editorDoc";
import { bundleNote, groupByCategory, type BundleMeta, type ExportPost } from "./exportBundle";

type Docx = typeof import("docx");

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
// Latin = Calibri; বাংলা (complex script) = Nirmala UI (Windows/Word-এ বিল্ট-ইন; অন্য জায়গায় Word নিজে বিকল্প ফন্ট নেয়)
export const DOCX_FONT = {
  ascii: "Calibri",
  hAnsi: "Calibri",
  eastAsia: "Calibri",
  cs: "Nirmala UI",
} as const;
const SIZE = 24; // ১২pt (half-points); বাংলা হরফ ছোট দেখায় বলে ১১ নয়
const MAX_LIST_LEVEL = 3;
const LINK_COLOR = "0563C1";

type Ctx = { d: Docx; ordInstance: number };

function inlineRuns(
  d: Docx,
  n: DocNode,
): (InstanceType<Docx["TextRun"]> | InstanceType<Docx["ExternalHyperlink"]>)[] {
  const out: (InstanceType<Docx["TextRun"]> | InstanceType<Docx["ExternalHyperlink"]>)[] = [];
  for (const c of n.content ?? []) {
    if (c.type === "hardBreak") {
      out.push(new d.TextRun({ break: 1 }));
      continue;
    }
    if (c.type !== "text" || !c.text) continue;
    const has = (m: string) => c.marks?.some((x) => x.type === m) ?? false;
    const link = c.marks?.find((x) => x.type === "link");
    const href = link && typeof link.attrs?.href === "string" ? link.attrs.href.trim() : "";
    const safe = href !== "" && isSafeHref(href);
    const run = new d.TextRun({
      text: c.text,
      bold: has("bold") || undefined,
      boldComplexScript: has("bold") || undefined,
      italics: has("italic") || undefined,
      italicsComplexScript: has("italic") || undefined,
      underline: has("underline") || safe ? {} : undefined,
      color: safe ? LINK_COLOR : undefined,
    });
    out.push(safe ? new d.ExternalHyperlink({ link: href, children: [run] }) : run);
  }
  return out;
}

type Opts = {
  quote: boolean;
  list?: { ordered: boolean; level: number; instance: number; first: boolean };
};

function blockToParas(ctx: Ctx, n: DocNode, o: Opts): Paragraph[] {
  const { d } = ctx;
  const kids = n.content ?? [];
  const quoteLook = o.quote
    ? {
        indent: { left: 567 },
        border: { left: { style: d.BorderStyle.SINGLE, size: 12, space: 8, color: "C96442" } },
      }
    : {};
  switch (n.type) {
    case "paragraph": {
      const numbering =
        o.list && o.list.first
          ? o.list.ordered
            ? { reference: "ord", level: o.list.level, instance: o.list.instance }
            : { reference: "bul", level: o.list.level }
          : undefined;
      const indent = o.list && !o.list.first ? { left: 720 * (o.list.level + 1) } : undefined;
      return [
        new d.Paragraph({
          children: inlineRuns(d, n),
          numbering,
          ...quoteLook,
          ...(indent ? { indent } : {}),
        }),
      ];
    }
    case "heading": {
      const h = Number(n.attrs?.level) === 3 ? d.HeadingLevel.HEADING_4 : d.HeadingLevel.HEADING_3;
      return [new d.Paragraph({ heading: h, children: inlineRuns(d, n) })];
    }
    case "horizontalRule":
      return [
        new d.Paragraph({
          children: [],
          border: { bottom: { style: d.BorderStyle.SINGLE, size: 6, space: 1, color: "999999" } },
        }),
      ];
    case "blockquote":
      return kids.flatMap((k) => blockToParas(ctx, k, { ...o, quote: true }));
    case "bulletList":
    case "orderedList": {
      const ordered = n.type === "orderedList";
      const instance = ordered ? ++ctx.ordInstance : 0;
      const level = Math.min(MAX_LIST_LEVEL, o.list ? o.list.level + 1 : 0);
      return kids.flatMap((li) =>
        (li.content ?? []).flatMap((k, i) =>
          blockToParas(ctx, k, {
            quote: o.quote,
            list: { ordered, level, instance, first: i === 0 },
          }),
        ),
      );
    }
    default:
      return [];
  }
}

const levels = (d: Docx, ordered: boolean) =>
  Array.from({ length: MAX_LIST_LEVEL + 1 }, (_, level) => ({
    level,
    format: ordered ? d.LevelFormat.DECIMAL : d.LevelFormat.BULLET,
    text: ordered ? `%${level + 1}.` : level % 2 === 0 ? "•" : "◦",
    alignment: d.AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));

const headStyle = (size: number, color?: string) => ({
  run: {
    font: DOCX_FONT,
    size,
    sizeComplexScript: size,
    bold: true,
    boldComplexScript: true,
    color,
  },
  paragraph: { spacing: { before: 280, after: 120 }, keepNext: true },
});

/** লেখাগুলো → .docx বাইট (ArrayBuffer)। `docx` এখানেই lazy লোড হয়। */
export async function buildDocx(posts: ExportPost[], meta: BundleMeta): Promise<ArrayBuffer> {
  const d = await import("docx");
  const ctx: Ctx = { d, ordInstance: 0 };
  const plain = (text: string, extra: { italics?: boolean; color?: string } = {}) =>
    new d.TextRun({
      text,
      italics: extra.italics,
      italicsComplexScript: extra.italics,
      color: extra.color,
    });

  const children: Paragraph[] = [
    new d.Paragraph({ heading: d.HeadingLevel.TITLE, children: [plain(meta.heading)] }),
    new d.Paragraph({
      children: [plain(bundleNote(meta, posts.length), { italics: true, color: "666666" })],
    }),
  ];
  groupByCategory(posts).forEach((g, gi) => {
    children.push(
      new d.Paragraph({
        heading: d.HeadingLevel.HEADING_1,
        pageBreakBefore: gi > 0,
        children: [plain(g.category)],
      }),
    );
    for (const p of g.posts) {
      children.push(
        new d.Paragraph({
          heading: d.HeadingLevel.HEADING_2,
          children: [plain(p.title || "(শিরোনামহীন)")],
        }),
      );
      if (p.whenMs !== null) {
        children.push(
          new d.Paragraph({
            children: [
              plain(formatDate(p.whenMs, meta.timeZone), { italics: true, color: "666666" }),
            ],
          }),
        );
      }
      const doc = parseBody(p.body);
      for (const n of doc.content ?? []) children.push(...blockToParas(ctx, n, { quote: false }));
    }
  });

  const file = new d.Document({
    creator: meta.heading,
    title: meta.heading,
    numbering: {
      config: [
        { reference: "bul", levels: levels(d, false) },
        { reference: "ord", levels: levels(d, true) }, // প্রতিটা সংখ্যা-তালিকা আলাদা instance → ১ থেকে শুরু
      ],
    },
    styles: {
      default: {
        document: {
          run: {
            font: DOCX_FONT,
            size: SIZE,
            sizeComplexScript: SIZE,
            language: { value: "en-US", bidirectional: "bn-BD" },
          },
          paragraph: { spacing: { line: 336, after: 120 } },
        },
        title: headStyle(44),
        heading1: headStyle(36, "A94E2F"),
        heading2: headStyle(30),
        heading3: headStyle(26),
        heading4: headStyle(24),
      },
    },
    sections: [{ children }],
  });
  return d.Packer.toArrayBuffer(file);
}
