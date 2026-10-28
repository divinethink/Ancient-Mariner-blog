// দিনলিপি → Word (.docx) — ব্রাউজারে তৈরি, শুধু read। `docx` lazy import (প্রথম লোডে ঢোকে না)।
// রুলড লাইন = প্রতি লাইনের নিচে পাতলা রেখা (Word-এ হুবহু ছাপার মতো নয়, কাছাকাছি); থিমের রং = পাতার পটভূমি + লেখা/তারিখের রং।
// ফন্ট: Word-এ হ্যান্ডরাইটিং ফন্ট embed হয় না — বাংলা Nirmala UI (বিল্ট-ইন); হ্যান্ডরাইটিং চাইলে PDF নিন।
import type { Paragraph, Table } from "docx";
import { bookCoverLines, bookStats, bookToc, bookYears, type BookCover } from "./diaryBook";
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
  const book = o.cover === "navy" || o.cover === "red" ? BOOK_COLORS[o.cover] : null;
  if (book) {
    // মলাট = এক-ঘরের টেবিল (পুরো পাতার উচ্চতা, রঙিন পটভূমি) — Word-এ পাতা-জোড়া পটভূমি আলাদা করা যায় না
    const bshade = { type: d.ShadingType.CLEAR, color: "auto", fill: book.bg };
    const bp = (text: string, size: number, before: number, bold = false) =>
      new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { before, after: 100 }, children: [run(text, { size, bold, color: book.fg })] });
    const lines = bookCoverLines(bookStats(entries));
    const years = bookYears(entries);
    const none = { style: d.BorderStyle.NONE, size: 0, color: "auto" };
    children.push(
      new d.Table({
        width: { size: 9638, type: d.WidthType.DXA },
        columnWidths: [9638],
        borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
        rows: [
          new d.TableRow({
            height: { value: 14400, rule: d.HeightRule.EXACT },
            children: [
              new d.TableCell({
                width: { size: 9638, type: d.WidthType.DXA },
                shading: bshade,
                verticalAlign: d.VerticalAlign.CENTER,
                children: [
                  ...(years ? [bp(years, 28, 0)] : []),
                  bp(o.bookTitle ?? o.title, 88, 1200, true),
                  bp("◆", 28, 200),
                  bp(o.author, 36, 400),
                  bp(o.subtitle, 26, 200),
                  ...lines.map((l, i) => bp(l, 24, i === 0 ? 1600 : 0)),
                ],
              }),
            ],
          }),
        ],
      }),
    );
  } else {
    children.push(
      centered(o.title, 80, 3600, true, pal.acc),
      centered(o.subtitle, 40, 200),
      centered(o.countLine, 28, 120),
      centered(o.author, 30, 1800, false, pal.acc),
    );
  }
  if (o.toc) {
    const rows = bookToc(entries);
    if (rows.length > 0) {
      children.push(new d.Paragraph({ pageBreakBefore: true, alignment: d.AlignmentType.CENTER, shading, spacing: { after: 240 }, children: [run(o.toc.title, { size: 52, bold: true, color: pal.acc })] }));
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
    children.push(
      new d.Paragraph({
        heading: d.HeadingLevel.HEADING_2,
        pageBreakBefore: true,
        shading,
        border: { bottom: { style: d.BorderStyle.SINGLE, size: 12, space: 2, color: pal.acc } },
        children: [run(parts ? parts.long : e.day, { size: 40, bold: true, color: pal.acc })],
      }),
    );
    if (parts) children.push(new d.Paragraph({ shading, spacing: { after: 60 }, children: [run(parts.weekday, { size: 24 })] }));
    if (e.title) children.push(new d.Paragraph({ shading, spacing: { after: 40 }, children: [run(e.title, { size: 30, bold: true })] }));
    const meta = [e.location ? `${o.placeLabel}: ${e.location}` : "", e.period ? `${o.periodLabel}: ${e.period}` : ""].filter(Boolean).join("   ·   ");
    if (meta) children.push(new d.Paragraph({ shading, spacing: { after: 80 }, children: [run(meta, { size: 22, color: pal.acc })] }));
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
    sections: [{ properties: { page: { size: A4, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } }, children }],
  });
  return d.Packer.toArrayBuffer(file);
}
