"use client";

// PDF = ব্রাউজারের প্রিন্ট। পর্দার বাইরে (কিন্তু দৃশ্যমান, যাতে ফন্ট লোড হয়) পাতাগুলো বসিয়ে window.print() ডাকে।
// শেষ হলে (afterprint) নিজেই সব গুটিয়ে নেয়। কিছু লেখে/মোছে না।
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { DiaryPage } from "@/components/diary/DiaryPage";
import { bn } from "@/i18n/bn";
import type { DownloadEntry } from "@/lib/diaryExport";
import type { DiaryLook } from "@/lib/diaryLook";

export type PrintJob = { entries: DownloadEntry[]; look: DiaryLook; rangeText: string; author: string; docTitle: string };

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
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
  return createPortal(
    <div className="diary-print-root">
      <div className="dpage dcover" data-dtheme={look.theme} data-dfont={look.font} data-dsize={look.size}>
        <h1 className="dcover-title">{bn.diary.dl.coverTitle}</h1>
        <p className="dcover-sub">{job.rangeText}</p>
        <p className="dcover-sub">{bn.diary.dl.count(bnNum(entries.length))}</p>
        <p className="dcover-author">{job.author}</p>
      </div>
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
              {l || "​"}
            </p>
          ))}
        </DiaryPage>
      ))}
    </div>,
    document.body,
  );
}
