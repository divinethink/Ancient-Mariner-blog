"use client";

// "ডাউনলোড" bottom-sheet (শুধু ড্যাশবোর্ড/ব্যক্তিগত): ধরন (PDF/Word) · পরিসর · ডিজাইন · কোন লেখা। শুধু read।
import { useCallback, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { Toggle } from "@/components/ui/Toggle";
import { getPostRepo } from "@/data/postRepo.wire";
import { bn } from "@/i18n/bn";
import { dayKey } from "@/lib/datetime";
import { fetchRange, fileName, rangeFor, rangeLabel, selectEntries, toEntries, type DownloadEntry, type RangeKind } from "@/lib/diaryExport";
import { BOOK_COVERS, DEFAULT_BOOK_COVER, type BookCover } from "@/lib/diaryBook";
import type { DiaryLook, DiaryTheme } from "@/lib/diaryLook";
import { DiaryPrintRoot, type PrintJob } from "./DiaryPrintRoot";
import { DiarySheet } from "./DiarySheet";
import { ThemePicker } from "./ThemePicker";

const L = bn.diary.dl;
const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
const KINDS: { value: RangeKind; label: string }[] = [
  { value: "day", label: L.day },
  { value: "month", label: L.month },
  { value: "year", label: L.year },
  { value: "all", label: L.allShort },
  { value: "custom", label: L.custom },
];
/** মলাটের ছোট নমুনা-রঙ (বইয়ের পিঠ + পাতা) */
const COVER_LOOK: Record<BookCover, { bg: string; ink: string; name: string }> = {
  plain: { bg: "#ffffff", ink: "#555555", name: L.coverPlain },
  navy: { bg: "#1f3a68", ink: "#f3dfa0", name: L.coverNavy },
  red: { bg: "#7a2820", ink: "#f6e3b4", name: L.coverRed },
};

type Props = { look: DiaryLook; sel: string; tz: string; author: string; onClose: () => void };

export function DiaryDownload({ look, sel, tz, author, onClose }: Props) {
  const [today] = useState(() => dayKey(Date.now(), tz));
  const [kind, setKind] = useState<RangeKind>("month");
  const [from, setFrom] = useState(sel);
  const [to, setTo] = useState(sel);
  const [theme, setTheme] = useState<DiaryTheme>(look.theme);
  const [onlyPublic, setOnlyPublic] = useState(false);
  const [cover, setCover] = useState<BookCover>(DEFAULT_BOOK_COVER);
  const [toc, setToc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [job, setJob] = useState<PrintJob | null>(null);
  const donePrint = useCallback(() => setJob(null), []);

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
      const coverLabel = kind === "month" ? label.replace(" ", " - ") : label; // মলাটে "অক্টোবর - ২০২৬"
      const summary = L.count(bnNum(entries.length));
      if (fmt === "pdf") {
        setJob({ entries, look: { ...look, theme }, rangeText: coverLabel, author, docTitle: fileName(kind, r, "pdf").replace(/\.pdf$/, ""), cover, toc });
        setMsg({ ok: true, text: `${summary}। ${L.printHint}` });
      } else {
        const { buildDiaryDocx, DIARY_DOCX_MIME } = await import("@/lib/diaryDocx");
        const buf = await buildDiaryDocx(entries, { theme, title: L.coverTitle, subtitle: coverLabel, author, countLine: L.count(bnNum(entries.length)), placeLabel: bn.diary.labelPlace,
          periodLabel: bn.diary.labelPeriod,
          cover,
          bookTitle: L.coverTitle,
          ...(toc ? { toc: { title: L.tocTitle, note: L.tocNote, entriesLabel: L.book.entries } } : {}),
        });
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

  const range = rangeFor(kind, sel, today, { from, to });
  const barText = range ? `${rangeLabel(kind, range)} · ${onlyPublic ? L.publicOnly : L.both}` : "";

  return (
    <>
      <DiarySheet
        title={L.title}
        closeLabel={L.close}
        onClose={onClose}
        busy={busy}
        footer={
          <>
            {msg && (
              <p role="status" className={`text-sm ${msg.ok ? "text-muted" : "text-accent-text"}`}>
                {msg.text}
              </p>
            )}
            {barText && <p className="text-center text-sm font-semibold">{barText}</p>}
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
          </>
        }
      >
        <section aria-label={L.which}>
          <h3 className="mb-2 text-sm font-semibold text-muted">{L.which}</h3>
          <Segmented<"both" | "public">
            label={L.which}
            value={onlyPublic ? "public" : "both"}
            options={[
              { value: "both", label: L.both },
              { value: "public", label: L.publicOnly },
            ]}
            onChange={(v) => setOnlyPublic(v === "public")}
          />
        </section>

        <section aria-label={L.range}>
          <h3 className="mb-2 text-sm font-semibold text-muted">{L.range}</h3>
          <Segmented<RangeKind> label={L.range} compact value={kind} options={KINDS} onChange={setKind} />
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
          <ThemePicker label={L.design} value={theme} onChange={setTheme} />
        </section>

        <section aria-label={L.cover}>
          <h3 className="mb-2 text-sm font-semibold text-muted">{L.cover}</h3>
          <div role="group" aria-label={L.cover} className="grid grid-cols-3 gap-2">
            {BOOK_COVERS.map((c) => {
              const v = COVER_LOOK[c];
              const on = cover === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCover(c)}
                  className={`flex min-h-11 flex-col items-center gap-1.5 rounded-xl border bg-surface px-1 py-2 ${on ? "border-2 border-btn-bg" : "border-line"}`}
                >
                  <span aria-hidden className="flex h-9 w-7 items-center justify-center rounded-sm border border-line text-xs font-bold shadow-sm" style={{ background: v.bg, color: v.ink }}>
                    অ
                  </span>
                  <span className={`text-center text-[11px] leading-tight ${on ? "font-semibold" : "text-muted"}`}>{v.name}</span>
                </button>
              );
            })}
          </div>
          <Toggle checked={toc} onChange={setToc} label={<span className="text-sm">{L.tocOn}</span>} />
        </section>
      </DiarySheet>
      {job && <DiaryPrintRoot job={job} onDone={donePrint} />}
    </>
  );
}
