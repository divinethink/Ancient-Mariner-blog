"use client";

// JSON থেকে পুনরুদ্ধার (P5b-৩): ফাইল বাছা → parse → dry-run (শুধু পড়া) → confirm → chunked লেখা → ফল/আবার চেষ্টা।
// ডিফল্ট = শুধু অনুপস্থিত doc যোগ; overwrite 'উন্নত' অংশে, আলাদা confirm-সহ। কোনো doc মোছা হয় না।
import { useRef, useState } from "react";
import { getRestoreTarget } from "@/data/restoreRepo.wire";
import { triggerSiteRebuild } from "@/data/rebuildClient";
import { bn } from "@/i18n/bn";
import { BACKUP_COLLECTIONS } from "@/lib/backup";
import {
  NON_RESTORABLE,
  RESTORE_MAX_BYTES,
  dryRun,
  parseBackupTexts,
  runRestore,
  type DryRun,
  type ParsedBackup,
  type RestoreResult,
} from "@/lib/restore";
import { ConfirmButton } from "../ConfirmButton";

type Phase = "idle" | "checking" | "ready" | "running" | "done" | "error";
const btn = "min-h-11 rounded-full bg-btn-bg px-5 text-btn-tx disabled:opacity-50";
const SITE_AFFECTING = ["posts", "siteSettings", "categories", "tags", "series", "pages", "media"] as const;

export function RestorePanel() {
  const t = bn.backup.restore;
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [plan, setPlan] = useState<DryRun | null>(null);
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [overwriteRun, setOverwriteRun] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0 || busy.current) return;
    setMsg(null);
    setResult(null);
    if ([...files].reduce((s, f) => s + f.size, 0) > RESTORE_MAX_BYTES) {
      setPhase("error");
      setMsg(t.tooBig);
      return;
    }
    setPhase("checking");
    try {
      const texts = await Promise.all([...files].map((f) => f.text()));
      const p = parseBackupTexts(texts);
      if (!p.ok) {
        setPhase("error");
        setMsg(t.err[p.error.code] ?? t.readFailed);
        return;
      }
      setParsed(p.value);
      setPlan(await dryRun(p.value, await getRestoreTarget()));
      setPhase("ready");
    } catch {
      setPhase("error");
      setMsg(t.readFailed);
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function run(overwrite: boolean) {
    if (!parsed || busy.current) return;
    busy.current = true;
    setOverwriteRun(overwrite);
    setPhase("running");
    setProgress([0, 0]);
    try {
      const r = await runRestore(parsed, await getRestoreTarget(), {
        overwrite,
        onProgress: (d, n) => setProgress([d, n]),
      });
      setResult(r);
      if (
        r.added + r.overwritten > 0 &&
        SITE_AFFECTING.some((c) => parsed.collections[c].length > 0)
      )
        void triggerSiteRebuild();
      setPhase("done");
    } catch {
      setPhase("error");
      setMsg(t.readFailed);
    } finally {
      busy.current = false;
    }
  }

  const retryable = phase === "done" && result !== null && result.failedDocs > 0;

  return (
    <section
      aria-label={t.title}
      className="mt-8 space-y-4 rounded-2xl border border-line bg-surface p-4"
    >
      <h2 className="font-serif text-xl font-bold">{t.title}</h2>
      <p className="text-sm text-muted">{t.intro}</p>
      <p className="text-sm text-muted">{t.takeExport}</p>

      {(phase === "idle" || phase === "error" || phase === "ready" || phase === "done") && (
        <>
          <input
            ref={input}
            type="file"
            multiple
            accept=".json,application/json"
            className="sr-only"
            id="restore-file"
            onChange={(e) => void onPick(e.target.files)}
          />
          <label
            htmlFor="restore-file"
            className={`${btn} inline-flex cursor-pointer items-center`}
          >
            {t.pick}
          </label>
        </>
      )}
      {phase === "error" && msg && (
        <p role="alert" className="text-accent-text">
          {msg}
        </p>
      )}
      {phase === "checking" && <p className="text-muted">{t.checking}</p>}

      {parsed && plan && (phase === "ready" || phase === "running") && (
        <div className="space-y-3">
          <p>{t.summary(parsed.files, plan.total)}</p>
          <ul className="space-y-1 text-sm">
            {BACKUP_COLLECTIONS.filter((c) => plan.rows[c].total > 0 && !NON_RESTORABLE.has(c)).map((c) => (
              <li key={c}>
                {t.row(
                  bn.backup.col[c],
                  plan.rows[c].total,
                  plan.rows[c].add,
                  plan.rows[c].existing,
                )}
              </li>
            ))}
          </ul>
          {parsed.skippedCollections.length > 0 && (
            <p className="text-sm text-muted">
              {t.skippedCols(parsed.skippedCollections.join(", "))}
            </p>
          )}
          {parsed.invalidDocs > 0 && (
            <p className="text-sm text-muted">{t.invalid(parsed.invalidDocs)}</p>
          )}
          <p className="text-sm text-muted">{t.cost(plan.total)}</p>
        </div>
      )}

      {phase === "ready" && plan && (
        <div className="space-y-3">
          {plan.add === 0 ? (
            <p>{t.nothingNew}</p>
          ) : (
            <ConfirmButton
              label={t.startMissing}
              question={t.confirmMissing(plan.add)}
              onConfirm={() => void run(false)}
              className={btn}
            />
          )}
          {plan.existing > 0 && (
            <details className="rounded-xl border border-line p-3">
              <summary className="min-h-11 cursor-pointer py-2">{t.advanced}</summary>
              <p className="my-2 text-sm text-accent-text">{t.advancedWarn}</p>
              <ConfirmButton
                label={t.startOverwrite}
                question={t.confirmOverwrite(plan.existing)}
                onConfirm={() => void run(true)}
                className="min-h-11 rounded-full border border-line px-5"
              />
            </details>
          )}
        </div>
      )}

      {phase === "running" && (
        <p role="status" className="text-muted">
          {t.running(progress[0], progress[1])}
        </p>
      )}
      {phase === "done" && result && (
        <div className="space-y-2">
          <p role="status">{t.done(result.added, result.overwritten, result.skippedExisting)}</p>
          {result.added + result.overwritten > 0 && (
            <p className="text-sm text-muted">{t.rebuildNote}</p>
          )}
          {retryable && (
            <>
              <p role="alert" className="text-accent-text">
                {t.failedSome(result.failedDocs)}
              </p>
              <button type="button" onClick={() => void run(overwriteRun)} className={btn}>
                {t.retry}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
