// দিনলিপি → Word (.docx) — ব্রাউজারে তৈরি, শুধু read। `docx` lazy import (প্রথম লোডে ঢোকে না)।
// রুলড লাইন = প্রতি লাইনের নিচে পাতলা রেখা (Word-এ হুবহু ছাপার মতো নয়, কাছাকাছি); থিমের রং = পাতার পটভূমি + লেখা/তারিখের রং।
// ফন্ট: Word-এ হ্যান্ডরাইটিং ফন্ট embed হয় না — বাংলা Nirmala UI (বিল্ট-ইন); হ্যান্ডরাইটিং চাইলে PDF নিন।
import type { Paragraph } from "docx";
import { dayParts, type DownloadEntry } from "./diaryExport";
import type { DiaryTheme } from "./diaryLook";
import { DOCX_FONT } from "./exportDocx";

/** থিম → Word-এর রং (hex, # ছাড়া): পটভূমি · লেখা · তারিখ/শিরোনাম · রুল-রেখা */
export const DOCX_PALETTE: Record<DiaryTheme, { bg: string; ink: string; acc: string; line: string }> = {
  paper: { bg: "FBF3DC", ink: "2B2118", acc: "8A3B2E", line: "DCCFA8" },
  night: { bg: "1F2230", ink: "EBE1C9", acc: "D9B36A", line: "343A53" },
  dot: { bg: "F5F2EA", ink: "1D3A6B", acc: "1D3A6B", line: "D5D1C2" },
  letter: { bg: "ECDCBD", ink: "4A2C1A", acc: "7A3D1C", line: "D4BF94" },
  rose: { bg: "F9CFC7", ink: "241210", acc: "8A2F26", line: "C79A92" },
  oyster: { bg: "DEDBD3", ink: "4A3322", acc: "7A5230", line: "BDB8AC" },
  terracotta: { bg: "F3E9D9", ink: "3B2118", acc: "A1472F", line: "E2D0B6" },
  slate: { bg: "F7F3E9", ink: "2D3829", acc: "4F5F41", line: "D6D8C6" },
  charcoal: { bg: "FAFAF6", ink: "2B2B2B", acc: "3C4049", line: "C9C9C0" },
  brick: { bg: "FAFAF6", ink: "4A1A14", acc: "8B3A2F", line: "DEB7B1" },
  navy: { bg: "FAFAF6", ink: "1D2A52", acc: "25406E", line: "BCC0D8" },
  forest: { bg: "FAFAF6", ink: "1F3A2A", acc: "2F6345", line: "B5CBBD" },
  sky: { bg: "FAFAF6", ink: "1D2A52", acc: "466190", line: "C3C6DC" },
  plum: { bg: "1F1A27", ink: "F0E8D8", acc: "A98BB5", line: "363046" },
  ink: { bg: "181B22", ink: "ECE4D0", acc: "9B9B9B", line: "2D3139" },
  gold: { bg: "1B1F2B", ink: "F0E8D4", acc: "D9B36A", line: "323849" },
  ruby: { bg: "FAFAF7", ink: "222222", acc: "8A3328", line: "CDCDCD" },
  teal: { bg: "FAFAF7", ink: "222222", acc: "1F6E75", line: "CDCDCD" },
  nbslate: { bg: "F9EFDC", ink: "2E241C", acc: "3C4049", line: "DCCFA8" },
  nbred: { bg: "F9EFDC", ink: "2E241C", acc: "8B3A2F", line: "DCCFA8" },
  nbteal: { bg: "F9EFDC", ink: "2E241C", acc: "1F6E75", line: "DCCFA8" },
  nbbig: { bg: "F9EFDC", ink: "2E241C", acc: "8B3A2F", line: "D4C29A" },
  week: { bg: "FAFAF7", ink: "1D1D1D", acc: "1D1D1D", line: "CDCDCD" },
};

export const DIARY_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const SIZE = 26; // ১৩pt (half-points)
const A4 = { width: 11906, height: 16838 };
const MARGIN = 1134; // ২ সেমি

export type DiaryDocxOpts = { theme: DiaryTheme; title: string; subtitle: string; author: string; countLine: string; placeLabel: string; periodLabel: string };

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

  const children: Paragraph[] = [
    centered(o.title, 80, 3600, true, pal.acc),
    centered(o.subtitle, 40, 200),
    centered(o.countLine, 28, 120),
    centered(o.author, 30, 1800, false, pal.acc),
  ];

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
