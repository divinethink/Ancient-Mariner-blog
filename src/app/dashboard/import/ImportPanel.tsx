"use client";

// P3c-ক: XML পড়ে dry-run হিসাব (কিছু লেখে না) · P3c-খ: নিশ্চিত করলে Draft + Private হিসেবে ইমপোর্ট (idempotent, আবার চালানো নিরাপদ)।
import { useMemo, useState } from "react";
import { getSlugOwners } from "@/data/importKeys";
import type { ImportResult } from "@/data/importRun";
import { bn } from "@/i18n/bn";
import { planWrites } from "@/lib/import/commit";
import { planImport, type ImportPlan } from "@/lib/import/plan";
import { parseWxr } from "./wxrDom";

type Phase = "idle" | "reading" | "done" | "error";
type Run = "idle" | "confirm" | "running" | "finished" | "failed";
const box = "rounded-2xl border border-line bg-surface p-4";
const t = bn.importWp;

export function ImportPanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [source, setSource] = useState("");
  const [site, setSite] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [owners, setOwners] = useState<Map<string, string>>(new Map());
  const [run, setRun] = useState<Run>("idle");
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setPhase("reading");
    setPlan(null);
    setRun("idle");
    setResult(null);
    let wxr;
    try {
      wxr = parseWxr(await f.text());
    } catch {
      setErr(t.parseError);
      setPhase("error");
      return;
    }
    try {
      const own = await getSlugOwners();
      setSite(wxr.siteTitle);
      setSource((cur) => cur.trim() || wxr.siteTitle.trim());
      setOwners(own);
      setPlan(planImport(wxr, { existingSlugs: new Set(own.keys()) }));
      setPhase("done");
    } catch {
      setErr(t.slugsError);
      setPhase("error");
    }
  }

  // সোর্স-নামই post-id-র অংশ ⇒ নাম বদলালে "নতুন/আগেই-ইমপোর্টেড" হিসাবও বদলায়
  const wp = useMemo(() => (plan && source.trim() ? planWrites(plan, source, owners) : null), [plan, source, owners]);

  async function startImport() {
    if (!plan || !wp) return;
    setRun("running");
    setProgress([0, wp.writes.length]);
    try {
      const { runWpImport } = await import("@/data/importRun.wire");
      const r = await runWpImport(plan, source, (d, t) => setProgress([d, t]));
      setResult(r);
      setOwners(await getSlugOwners().catch(() => owners));
      setRun("finished");
    } catch {
      setRun("failed");
    }
  }

  const s = plan?.summary;
  const dropped = s ? Object.entries(s.dropped).filter(([k]) => k !== "img") : [];
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm text-muted">{t.sourceLabel}</span>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder={t.sourcePlaceholder}
          className="min-h-11 w-full rounded-xl border border-line bg-surface px-3"
        />
      </label>
      <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-btn-bg px-5 text-btn-tx">
        {t.pick}
        <input
          type="file"
          accept=".xml,text/xml,application/xml"
          className="sr-only"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {phase === "reading" && <p className="text-muted">{t.reading}</p>}
      {phase === "error" && (
        <p role="alert" className="text-accent-text">
          {err}
        </p>
      )}

      {plan && s && phase === "done" && (
        <div className="space-y-3">
          <section className={box}>
            <p className="font-semibold">{t.site(site || source)}</p>
            <p className="text-lg">{t.posts(s.totalPosts)}</p>
            <p className="text-sm text-muted">{t.bySource(s.bySource.publish, s.bySource.draft, s.bySource.private)}</p>
            <p className="text-sm text-muted">{t.allDraft}</p>
            <p className="mt-2 text-sm text-muted">
              {t.tags(s.tagCount)} · {t.words(s.words)}
              {s.skipped.trash > 0 && ` · ${t.skippedTrash(s.skipped.trash)}`}
            </p>
          </section>

          <section className={box}>
            <h2 className="mb-1 font-semibold">{t.categories}</h2>
            <ul className="space-y-1">
              {s.categories.map((c) => (
                <li key={c.name} className="flex justify-between">
                  <span>{c.name}</span>
                  <span>{c.count}</span>
                </li>
              ))}
            </ul>
          </section>

          {s.images.total > 0 && (
            <section className={box}>
              <h2 className="mb-1 font-semibold">{t.imagesTitle(s.images.total)}</h2>
              <p className="mb-2 text-sm text-muted">{t.imagesNote}</p>
              <ul className="space-y-1 break-all text-sm">
                {s.images.byHost.map((h) => (
                  <li key={h.host} className="flex justify-between gap-3">
                    <span>{h.host}</span>
                    <span>{h.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {dropped.length > 0 && (
            <section className={box}>
              <h2 className="mb-1 font-semibold">{t.droppedTitle}</h2>
              <ul className="text-sm">
                {dropped.map(([k, n]) => (
                  <li key={k}>
                    {k}: {n}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {s.conflicts.length > 0 && (
            <section className={box}>
              <h2 className="mb-1 font-semibold">{t.conflictsTitle(s.conflicts.length)}</h2>
              <ul className="space-y-1 text-sm">
                {s.conflicts.map((c) => (
                  <li key={`${c.slug}-${c.with}-${c.title}`}>
                    {c.title} — {c.with === "file" ? t.conflictFile : t.conflictExisting}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {s.oversize.length > 0 && (
            <section className={box}>
              <h2 className="mb-1 font-semibold">{t.oversizeTitle(s.oversize.length)}</h2>
              <ul className="text-sm">
                {s.oversize.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>
          )}

          {(s.trashResidue > 0 || s.empty > 0 || s.noDate > 0) && (
            <section className={box}>
              <h2 className="mb-1 font-semibold">{t.flagsTitle}</h2>
              <ul className="text-sm">
                {s.trashResidue > 0 && <li>{t.trashResidue(s.trashResidue)}</li>}
                {s.empty > 0 && <li>{t.empty(s.empty)}</li>}
                {s.noDate > 0 && <li>{t.noDate(s.noDate)}</li>}
              </ul>
            </section>
          )}

          {s.pages.length > 0 && (
            <section className={box}>
              <h2 className="mb-1 font-semibold">{t.pagesTitle}</h2>
              <ul className="text-sm">
                {s.pages.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          )}

          <section className={box}>
            <h2 className="mb-1 font-semibold">{t.sample}</h2>
            <ul className="space-y-1 text-sm">
              {plan.posts.slice(0, 5).map((p) => (
                <li key={p.wpId}>
                  {p.title} <span className="text-muted">· /{p.slug} · {p.wordCount}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className={box} aria-live="polite">
            {!source.trim() && <p className="text-accent-text">{t.needSource}</p>}
            {wp && run !== "finished" && (
              <p className="mb-2">
                {t.willImport(wp.writes.length)}
                {wp.already > 0 && <span className="text-muted"> · {t.alreadyDone(wp.already)}</span>}
                {wp.oversize.length > 0 && <span className="text-muted"> · {t.oversizeSkip(wp.oversize.length)}</span>}
              </p>
            )}
            {run === "running" && (
              <div className="mb-2">
                <progress className="w-full" max={progress[1]} value={progress[0]} aria-label={t.progressLabel} />
                <p className="text-sm text-muted">{t.progress(progress[0], progress[1])}</p>
              </div>
            )}
            {run === "failed" && (
              <p role="alert" className="mb-2 text-accent-text">
                {t.runFailed}
              </p>
            )}
            {result && (run === "finished" || run === "failed") && <ResultView r={result} />}
            {run === "confirm" && <p className="mb-2 text-sm text-muted">{t.confirm(wp?.writes.length ?? 0)}</p>}
            <div className="flex flex-wrap gap-2">
              {run === "confirm" ? (
                <>
                  <button type="button" onClick={() => void startImport()} className="min-h-11 rounded-full bg-btn-bg px-5 text-btn-tx">
                    {t.confirmYes}
                  </button>
                  <button type="button" onClick={() => setRun("idle")} className="min-h-11 rounded-full border border-line px-5">
                    {t.cancel}
                  </button>
                </>
              ) : (
                run !== "running" &&
                wp &&
                wp.writes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => (run === "idle" ? setRun("confirm") : void startImport())}
                    className="min-h-11 rounded-full bg-btn-bg px-5 text-btn-tx"
                  >
                    {run === "failed" || (result && result.failed > 0) ? t.retry : t.importBtn}
                  </button>
                )
              )}
            </div>
            {run === "idle" && <p className="mt-2 text-sm text-muted">{t.noWriteUntil}</p>}
          </section>
        </div>
      )}
    </div>
  );
}

function ResultView({ r }: { r: ImportResult }) {
  return (
    <div className="mb-2 space-y-1">
      <p className="font-semibold">{t.doneTitle(r.imported)}</p>
      {r.already > 0 && <p className="text-sm text-muted">{t.alreadyDone(r.already)}</p>}
      {(r.termsCreated.categories > 0 || r.termsCreated.tags > 0) && (
        <p className="text-sm text-muted">{t.termsMade(r.termsCreated.categories, r.termsCreated.tags)}</p>
      )}
      {r.oversize.length > 0 && (
        <p className="text-sm text-muted">
          {t.oversizeSkip(r.oversize.length)}: {r.oversize.join(", ")}
        </p>
      )}
      {r.invalid > 0 && <p className="text-sm text-muted">{t.invalidSkip(r.invalid)}</p>}
      {r.failed > 0 && (
        <p role="alert" className="text-accent-text">
          {t.failedSome(r.failed)}: {r.failedTitles.join(", ")}
        </p>
      )}
      {r.failed === 0 && <p className="text-sm text-muted">{t.nextStep}</p>}
    </div>
  );
}
