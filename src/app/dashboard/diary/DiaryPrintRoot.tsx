"use client";

// PDF = ব্রাউজারের প্রিন্ট। পর্দার বাইরে (কিন্তু দৃশ্যমান, যাতে ফন্ট লোড হয়) পাতাগুলো বসিয়ে window.print() ডাকে।
// শেষ হলে (afterprint) নিজেই সব গুটিয়ে নেয়। কিছু লেখে/মোছে না।
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { DiaryPage } from "@/components/diary/DiaryPage";
import { bn } from "@/i18n/bn";
import { bookCoverLines, bookStats, bookToc, bookYears, type BookCover } from "@/lib/diaryBook";
import { dayParts, type DownloadEntry } from "@/lib/diaryExport";
import type { DiaryLook } from "@/lib/diaryLook";

export type PrintJob = { entries: DownloadEntry[]; look: DiaryLook; rangeText: string; author: string; docTitle: string; cover?: BookCover; toc?: boolean };

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
/** ইংরেজি শব্দ (যেমন HR) আলাদা span-এ — হাতের-লেখা ফন্টে ল্যাটিন নেই, তাই ফলব্যাক ফন্ট ছোট ও বাঁকা করে মেলানো */
const LATIN = /([A-Za-z][A-Za-z0-9]*(?:[ '.&-][A-Za-z0-9]+)*)/g;
function withLatin(text: string) {
  if (!/[A-Za-z]/.test(text)) return text;
  return text.split(LATIN).map((part, k) => (k % 2 === 1 ? <span key={k} className="dlat">{part}</span> : part));
}
const wordCount = (lines: readonly string[]) => lines.join(" ").split(/\s+/).filter(Boolean).length;

export function DiaryPrintRoot({ job, onDone }: { job: PrintJob; onDone: () => void }) {
  useEffect(() => {
    const prevTitle = document.title;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      document.body.classList.remove("diary-printing");
      document.title = prevTitle;
      window.removeEventListener("afterprint", finish);
      onDone();
    };
    document.body.classList.add("diary-printing");
    document.title = job.docTitle;
    window.addEventListener("afterprint", finish);
    let dead = false;
    const go = async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      try {
        await document.fonts?.ready;
      } catch {
        /* ফন্ট না এলেও ছাপা চলবে */
      }
      if (!dead) window.print();
    };
    void go();
    return () => {
      dead = true;
      finish();
    };
  }, [job, onDone]);

  const { entries, look } = job;
  const D = bn.diary.dl;
  const book = job.cover === "navy" || job.cover === "red" ? job.cover : null;
  const toc = job.toc ? bookToc(entries) : [];
  const years = bookYears(entries);
  const stats = bookCoverLines(bookStats(entries));
  return createPortal(
    <div className="diary-print-root">
      {book ? (
        <div className="dpage dbook" data-dbook={book} data-dfont={look.font} data-dsize={look.size}>
          <div className="dbook-frame">
            {years && <p className="dbook-year">{years}</p>}
            <h1 className="dbook-title">{book === "navy" ? D.bookTitleNavy : D.bookTitleRed}</h1>
            <span className="dbook-rule" />
            <p className="dbook-author">{job.author}</p>
            <p className="dbook-stat">{job.rangeText}</p>
            {stats.map((s) => (
              <p key={s} className="dbook-stat">
                {s}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <div className="dpage dcover" data-dtheme={look.theme} data-dfont={look.font} data-dsize={look.size}>
          <h1 className="dcover-title">{D.coverTitle}</h1>
          <p className="dcover-sub">{job.rangeText}</p>
          <p className="dcover-sub">{D.count(bnNum(entries.length))}</p>
          <p className="dcover-author">{job.author}</p>
        </div>
      )}
      {toc.length > 0 && (
        <div className="dpage dtoc" data-dfont={look.font} data-dsize={look.size}>
          <h2>{D.tocTitle}</h2>
          {toc.map((r) => (
            <div key={r.key}>
              <div className="dtoc-row dtoc-month">
                <span>{r.label}</span>
                <i />
                <span>{D.book.entries(bnNum(r.count))}</span>
              </div>
              {entries.map((e, i) =>
                e.day.slice(0, 7) === r.key ? (
                  <div key={e.id} className="dtoc-row dtoc-day">
                    <span>{[dayParts(e.day)?.long ?? e.day, e.title].filter(Boolean).join(" — ")}</span>
                    <i />
                    <span>{D.pageLbl} {bnNum(i + 1)}</span>
                  </div>
                ) : null,
              )}
            </div>
          ))}
          <p className="dtoc-note">{D.tocNote}</p>
        </div>
      )}
      {entries.map((e, i) => (
        <DiaryPage
          key={e.id}
          day={e.day}
          title={e.title || undefined}
          location={e.location}
          period={e.period}
          night={e.night}
          look={look}
          footer={
            <>
              <span>{bn.diary.words(bnNum(wordCount(e.lines)))}</span>
              <span>
                {bn.diary.dl.pageLbl} {bnNum(i + 1)}
              </span>
            </>
          }
        >
          {e.lines.map((l, j) => (
            <p key={j} className="dline">
              {l ? withLatin(l) : "​"}
            </p>
          ))}
        </DiaryPage>
      ))}
    </div>,
    document.body,
  );
}
