// দিনলিপি → Word (.docx) — ব্রাউজারে তৈরি, শুধু read। `docx` lazy import (প্রথম লোডে ঢোকে না)।
// রুলড লাইন = প্রতি লাইনের নিচে পাতলা রেখা (Word-এ হুবহু ছাপার মতো নয়, কাছাকাছি); থিমের রং = পাতার পটভূমি + লেখা/তারিখের রং।
// ফন্ট: Word-এ হ্যান্ডরাইটিং ফন্ট embed হয় না — বাংলা Nirmala UI (বিল্ট-ইন); হ্যান্ডরাইটিং চাইলে PDF নিন।
import type { Paragraph, Table } from "docx";
import { bookToc, type BookCover } from "./diaryBook";
import { dayParts, type DownloadEntry } from "./diaryExport";
import type { DiaryTheme } from "./diaryLook";
import { DOCX_FONT } from "./exportDocx";

/** থিম → Word-এর রং (hex, # ছাড়া): পটভূমি · লেখা · তারিখ/শিরোনাম · রুল-রেখা */
export const DOCX_PALETTE: Record<DiaryTheme, { bg: string; ink: string; acc: string; line: string }> = {
  charcoal: { bg: "FAFAF6", ink: "2B2B2B", acc: "3C4049", line: "C9C9C0" },
  brick: { bg: "FAFAF6", ink: "4A1A14", acc: "8B3A2F", line: "DEB7B1" },
  forest: { bg: "FAFAF6", ink: "1F3A2A", acc: "2F6345", line: "B5CBBD" },
  sky: { bg: "FAFAF6", ink: "1D2A52", acc: "466190", line: "C3C6DC" },
  ink: { bg: "181B22", ink: "ECE4D0", acc: "9B9B9B", line: "2D3139" },
  nbred: { bg: "F9EFDC", ink: "2E241C", acc: "8B3A2F", line: "DCCFA8" },
  nbbig: { bg: "F9EFDC", ink: "2E241C", acc: "8B3A2F", line: "D4C29A" },
  week: { bg: "FAFAF7", ink: "1D1D1D", acc: "1D1D1D", line: "CDCDCD" },
  moon: { bg: "0D1030", ink: "E8E6FF", acc: "FFE9A8", line: "2A2F66" },
  postcard: { bg: "EFE3C9", ink: "3A2A1C", acc: "7A2418", line: "CDBB94" },
  lantern: { bg: "0B0806", ink: "F3DCB8", acc: "FFB35C", line: "3A2616" },
  fog: { bg: "DFE7EE", ink: "2C3E50", acc: "46607A", line: "B8C6D3" },
};

export const DIARY_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const SIZE = 26; // ১৩pt (half-points)
const A4 = { width: 11906, height: 16838 };
const MARGIN = 1134; // ২ সেমি
const COVER_H = 16700; // বই-মলাট: মার্জিনহীন পুরো পাতা (A4 উচ্চতার সামান্য কম — পরের ফাঁকা পাতা ঠেকাতে)

/** বই-মলাটের রং (hex, # ছাড়া): পটভূমি · সোনালি লেখা */
const BOOK_COLORS = { navy: { bg: "1F3A68", fg: "F3DFA0" }, red: { bg: "7A2820", fg: "F6E3B4" } } as const;

export type DiaryDocxOpts = {
  theme: DiaryTheme;
  title: string;
  subtitle: string;
  author: string;
  countLine: string;
  placeLabel: string;
  periodLabel: string;
  /** বই-মলাট (navy/red); না দিলে বা plain হলে সাদামাটা মলাট */
  cover?: BookCover;
  /** বই-মলাটের শিরোনাম (cover navy/red হলে) */
  bookTitle?: string;
  /** মাসভিত্তিক সূচিপত্র যোগ করা হবে কিনা (+ শিরোনাম ও টীকা) */
  toc?: { title: string; note: string; entriesLabel: (n: string) => string };
};

/** এন্ট্রিগুলো → .docx বাইট। মলাট + প্রতি এন্ট্রি নতুন পাতায় */
export async function buildDiaryDocx(entries: readonly DownloadEntry[], o: DiaryDocxOpts): Promise<ArrayBuffer> {
  const d = await import("docx");
  const pal = DOCX_PALETTE[o.theme];
  const shading = { type: d.ShadingType.CLEAR, color: "auto", fill: pal.bg };
  const run = (text: string, extra: { size?: number; bold?: boolean; color?: string } = {}) =>
    new d.TextRun({
      text,
      color: extra.color ?? pal.ink,
      size: extra.size ?? SIZE,
      sizeComplexScript: extra.size ?? SIZE,
      bold: extra.bold || undefined,
      boldComplexScript: extra.bold || undefined,
    });
  const centered = (text: string, size: number, before: number, bold = false, color?: string) =>
    new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { before, after: 120 }, shading, children: [run(text, { size, bold, color: color ?? pal.ink })] });

  const children: (Paragraph | Table)[] = [];
  const coverChildren: (Paragraph | Table)[] = [];
  let fresh = o.cover === "navy" || o.cover === "red"; // নতুন section-এর শুরুতে (বই-মলাটের পর) আলাদা page-break লাগে না
  const book = o.cover === "navy" || o.cover === "red" ? BOOK_COLORS[o.cover] : null;
  if (book) {
    // মলাট = এক-ঘরের টেবিল (পুরো পাতার উচ্চতা, রঙিন পটভূমি) — Word-এ পাতা-জোড়া পটভূমি আলাদা করা যায় না
    const bshade = { type: d.ShadingType.CLEAR, color: "auto", fill: book.bg };
    const bp = (text: string, size: number, before: number, bold = false) =>
      new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { before, after: 100 }, children: [run(text, { size, bold, color: book.fg })] });
    const none = { style: d.BorderStyle.NONE, size: 0, color: "auto" };
    coverChildren.push(
      new d.Table({
        width: { size: A4.width, type: d.WidthType.DXA },
        columnWidths: [A4.width],
        borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
        rows: [
          new d.TableRow({
            height: { value: COVER_H, rule: d.HeightRule.EXACT },
            children: [
              new d.TableCell({
                width: { size: A4.width, type: d.WidthType.DXA },
                shading: bshade,
                verticalAlign: d.VerticalAlign.CENTER,
                children: [
                  bp(o.bookTitle ?? o.title, 88, 0, true),
                  bp(o.subtitle, 36, 400),
                ],
              }),
            ],
          }),
        ],
      }),
      // Word-এ টেবিলের পরে অনুচ্ছেদ লাগে; ১pt-র ফাঁকা অনুচ্ছেদ, যাতে ফাঁকা পাতা না আসে
      new d.Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: d.LineRuleType.EXACT }, children: [new d.TextRun({ text: "", size: 2 })] }),
    );
  } else {
    children.push(
      centered(o.title, 80, 3600, true, pal.acc),
      centered(o.subtitle, 40, 200),
    );
  }
  if (o.toc) {
    const rows = bookToc(entries);
    if (rows.length > 0) {
      children.push(new d.Paragraph({ pageBreakBefore: !fresh, alignment: d.AlignmentType.CENTER, shading, spacing: { after: 240 }, children: [run(o.toc.title, { size: 52, bold: true, color: pal.acc })] }));
      fresh = false;
      for (const r of rows) {
        children.push(
          new d.Paragraph({
            shading,
            spacing: { after: 100 },
            tabStops: [{ type: d.TabStopType.RIGHT, position: 9638, leader: d.LeaderType.DOT }],
            children: [run(`${r.label}\t${o.toc.entriesLabel(r.count.toLocaleString("bn-BD", { useGrouping: false }))}`, { size: 28 })],
          }),
        );
      }
      children.push(new d.Paragraph({ shading, alignment: d.AlignmentType.CENTER, spacing: { before: 240 }, children: [run(o.toc.note, { size: 22, color: pal.acc })] }));
    }
  }

  entries.forEach((e) => {
    const parts = dayParts(e.day);
    const brk = !fresh;
    fresh = false;
    // পাতার শুরুতে ১pt-র অনুচ্ছেদ: টেবিলে page-break বসানো যায় না, তাই নতুন পাতা এটাই শুরু করে
    children.push(new d.Paragraph({ pageBreakBefore: brk, shading, spacing: { before: 0, after: 0, line: 20, lineRule: d.LineRuleType.EXACT }, children: [new d.TextRun({ text: "", size: 2 })] }));
    const none = { style: d.BorderStyle.NONE, size: 0, color: "auto" };
    const meta = e.location ? `${o.placeLabel}: ${e.location}` : "";
    const left: Paragraph[] = [
      new d.Paragraph({ shading, spacing: { before: 60, after: 40 }, children: e.title ? [run(e.title, { size: 32, bold: true })] : [] }),
      ...(meta ? [new d.Paragraph({ shading, spacing: { after: 40 }, children: [run(meta, { size: 22, color: pal.acc })] })] : []),
    ];
    const right: Paragraph[] = [
      new d.Paragraph({ heading: d.HeadingLevel.HEADING_2, alignment: d.AlignmentType.RIGHT, shading, spacing: { before: 0, after: 20 }, children: [run(parts ? parts.long : e.day, { size: 40, bold: true, color: pal.acc })] }),
      ...(parts ? [new d.Paragraph({ alignment: d.AlignmentType.RIGHT, shading, spacing: { after: 20 }, children: [run(parts.weekday, { size: 24 })] })] : []),
      ...(e.period ? [new d.Paragraph({ alignment: d.AlignmentType.RIGHT, shading, spacing: { after: 60 }, children: [run(`${o.periodLabel}: ${e.period}`, { size: 22, color: pal.acc })] })] : []),
    ];
    const cellBorders = { top: none, left: none, right: none, bottom: { style: d.BorderStyle.SINGLE, size: 12, space: 2, color: pal.acc } };
    children.push(
      new d.Table({
        width: { size: 9638, type: d.WidthType.DXA },
        columnWidths: [5638, 4000],
        borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
        rows: [
          new d.TableRow({
            cantSplit: true,
            children: [
              new d.TableCell({ width: { size: 5638, type: d.WidthType.DXA }, shading, borders: cellBorders, verticalAlign: d.VerticalAlign.TOP, children: left }),
              new d.TableCell({ width: { size: 4000, type: d.WidthType.DXA }, shading, borders: cellBorders, verticalAlign: d.VerticalAlign.TOP, children: right }),
            ],
          }),
        ],
      }),
      new d.Paragraph({ shading, spacing: { before: 0, after: 80 }, children: [] }),
    );
    for (const line of e.lines) {
      children.push(
        new d.Paragraph({
          shading,
          spacing: { line: 440, after: 0 },
          border: { bottom: { style: d.BorderStyle.SINGLE, size: 4, space: 2, color: pal.line } },
          children: line === "" ? [] : [run(line)],
        }),
      );
    }
  });

  const heading2 = {
    run: { font: DOCX_FONT, size: 40, sizeComplexScript: 40, bold: true, boldComplexScript: true, color: pal.acc },
    paragraph: { spacing: { before: 0, after: 80 }, keepNext: true },
  };
  const file = new d.Document({
    creator: o.author,
    title: `${o.title} — ${o.subtitle}`,
    background: { color: pal.bg },
    styles: {
      default: {
        document: {
          run: { font: DOCX_FONT, size: SIZE, sizeComplexScript: SIZE, color: pal.ink, language: { value: "en-US", bidirectional: "bn-BD" } },
          paragraph: { spacing: { line: 336, after: 120 } },
        },
        heading2,
      },
    },
    sections: [
      ...(coverChildren.length > 0 ? [{ properties: { page: { size: A4, margin: { top: 0, right: 0, bottom: 0, left: 0 } } }, children: coverChildren }] : []),
      { properties: { page: { size: A4, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } }, children },
    ],
  });
  return d.Packer.toArrayBuffer(file);
}
