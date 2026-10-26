"use client";

// "ডাউনলোড" bottom-sheet (শুধু ড্যাশবোর্ড/ব্যক্তিগত): ধরন (PDF/Word) · পরিসর · ডিজাইন · কোন লেখা। শুধু read।
import { useCallback, useEffect, useRef, useState } from "react";
import { getPostRepo } from "@/data/postRepo.wire";
import { bn } from "@/i18n/bn";
import { dayKey } from "@/lib/datetime";
import { estimatePages, fetchRange, fileName, rangeFor, rangeLabel, selectEntries, toEntries, type DownloadEntry, type RangeKind } from "@/lib/diaryExport";
import { DIARY_THEMES_CLASSIC, DIARY_THEMES_NEW, type DiaryLook, type DiaryTheme } from "@/lib/diaryLook";
import { DiaryPrintRoot, type PrintJob } from "./DiaryPrintRoot";

const L = bn.diary.dl;
const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
const chip = (on: boolean) => `min-h-11 rounded-full border px-4 text-base ${on ? "border-btn-bg bg-btn-bg text-btn-tx" : "border-line bg-surface"}`;
const KINDS: { k: RangeKind; t: string }[] = [
  { k: "day", t: L.day },
  { k: "month", t: L.month },
  { k: "year", t: L.year },
  { k: "all", t: L.allShort },
  { k: "custom", t: L.custom },
];

type Props = { look: DiaryLook; sel: string; tz: string; author: string; onClose: () => void };

export function DiaryDownload({ look, sel, tz, author, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [today] = useState(() => dayKey(Date.now(), tz));
  const [kind, setKind] = useState<RangeKind>("month");
  const [from, setFrom] = useState(sel);
  const [to, setTo] = useState(sel);
  const [theme, setTheme] = useState<DiaryTheme>(look.theme);
  const [onlyPublic, setOnlyPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [job, setJob] = useState<PrintJob | null>(null);
  const donePrint = useCallback(() => setJob(null), []);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose, busy]);

  async function run(fmt: "pdf" | "docx") {
    if (busy) return;
    const r = rangeFor(kind, sel, today, { from, to });
    if (!r) return setMsg({ ok: false, text: L.badRange });
    setBusy(true);
    setMsg({ ok: true, text: L.working });
    try {
      const repo = await getPostRepo();
      const posts = await fetchRange((x) => repo.listDiary(x), r, Number(today.slice(0, 4)));
      const entries: DownloadEntry[] = toEntries(selectEntries(posts, onlyPublic), tz);
      if (entries.length === 0) return setMsg({ ok: false, text: L.empty });
      const label = rangeLabel(kind, r);
      const summary = L.summary(bnNum(entries.length), bnNum(estimatePages(entries)));
      if (fmt === "pdf") {
        setJob({ entries, look: { ...look, theme }, rangeText: label, author, docTitle: fileName(kind, r, "pdf").replace(/\.pdf$/, "") });
        setMsg({ ok: true, text: `${summary}। ${L.printHint}` });
      } else {
        const { buildDiaryDocx, DIARY_DOCX_MIME } = await import("@/lib/diaryDocx");
        const buf = await buildDiaryDocx(entries, { theme, title: L.coverTitle, subtitle: label, author, countLine: L.count(bnNum(entries.length)), placeLabel: bn.diary.labelPlace, periodLabel: bn.diary.labelPeriod });
        const url = URL.createObjectURL(new Blob([buf], { type: DIARY_DOCX_MIME }));
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName(kind, r, "docx");
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        setMsg({ ok: true, text: `${L.wordDone} ${L.wordNote2}` });
      }
    } catch {
      setMsg({ ok: false, text: L.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button type="button" aria-label={L.close} onClick={onClose} disabled={busy} className="absolute inset-0 bg-black/40" tabIndex={-1} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={L.title} className="relative max-h-[88vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-bg p-5 md:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold">{L.title}</h2>
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-full border border-line px-4">
            {L.close}
          </button>
        </div>

        <section aria-label={L.range}>
          <h3 className="mb-2 text-sm font-semibold text-muted">{L.range}</h3>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((x) => (
              <button key={x.k} type="button" aria-pressed={kind === x.k} onClick={() => setKind(x.k)} className={chip(kind === x.k)}>
                {x.t}
              </button>
            ))}
          </div>
          {kind === "custom" && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-sm text-muted">
                {L.from}
                <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-2 text-base" />
              </label>
              <label className="text-sm text-muted">
                {L.to}
                <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-2 text-base" />
              </label>
            </div>
          )}
        </section>

        <section aria-label={L.design}>
          <h3 className="mb-2 text-sm font-semibold text-muted">{L.design}</h3>
          <div className="flex flex-wrap gap-2">
            {[...DIARY_THEMES_CLASSIC, ...DIARY_THEMES_NEW].map((t) => (
              <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)} className={`${chip(theme === t)} text-sm`}>
                {bn.diary.look.themes[t]}
              </button>
            ))}
          </div>
        </section>

        <section aria-label={L.which}>
          <h3 className="mb-2 text-sm font-semibold text-muted">{L.which}</h3>
          <div className="flex gap-2">
            <button type="button" aria-pressed={!onlyPublic} onClick={() => setOnlyPublic(false)} className={`flex-1 ${chip(!onlyPublic)} text-sm`}>
              {L.both}
            </button>
            <button type="button" aria-pressed={onlyPublic} onClick={() => setOnlyPublic(true)} className={`flex-1 ${chip(onlyPublic)} text-sm`}>
              {L.publicOnly}
            </button>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => void run("pdf")} className="min-h-12 rounded-full bg-btn-bg px-4 font-semibold text-btn-tx disabled:opacity-50">
            {L.makePdf}
            <span className="block text-xs font-normal opacity-80">{L.pdfNote}</span>
          </button>
          <button type="button" disabled={busy} onClick={() => void run("docx")} className="min-h-12 rounded-full border border-btn-bg px-4 font-semibold disabled:opacity-50">
            {L.makeWord}
            <span className="block text-xs font-normal text-muted">{L.wordNote}</span>
          </button>
        </div>
        {msg && (
          <p role="status" className={`text-sm ${msg.ok ? "text-muted" : "text-accent-text"}`}>
            {msg.text}
          </p>
        )}
      </div>
      {job && <DiaryPrintRoot job={job} onDone={donePrint} />}
    </div>
  );
}
