"use client";

// JSON ব্যাকআপ এক্সপোর্ট (P2c-৩): শুধু read। আগে count() দেখিয়ে confirm; পাতায় পাতায় পড়ে Blob-parts-এ জমায় (lib/backup)।
import { useEffect, useRef, useState } from "react";
import { getBackupSource } from "@/data/backupRepo";
import { bn } from "@/i18n/bn";
import {
  BACKUP_COLLECTIONS,
  DAILY_READ_LIMIT,
  backupFileName,
  exportBackup,
  readPercent,
  totalDocs,
  type BackupCollection,
} from "@/lib/backup";
import { ConfirmButton } from "../ConfirmButton";

type Counts = Record<BackupCollection, number>;
type Phase = "idle" | "counting" | "ready" | "running" | "done" | "error";

const btn = "min-h-12 w-full rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50";

export function BackupPanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [done, setDone] = useState(0);
  const [file, setFile] = useState<{ url: string; name: string; size: number } | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abort.current?.abort();
    },
    [],
  );
  useEffect(() => () => void (file && URL.revokeObjectURL(file.url)), [file]);

  async function count() {
    setPhase("counting");
    setFile(null);
    try {
      const src = await getBackupSource();
      const entries = await Promise.all(BACKUP_COLLECTIONS.map(async (c) => [c, await src.count(c)] as const));
      setCounts(Object.fromEntries(entries) as Counts);
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }

  async function run() {
    if (phase === "running") return;
    const ac = new AbortController();
    abort.current = ac;
    setPhase("running");
    setDone(0);
    try {
      const src = await getBackupSource();
      const parts: string[] = [];
      const now = new Date();
      await exportBackup(src, {
        sink: (c) => parts.push(c),
        now,
        signal: ac.signal,
        onProgress: (_c, n) => setDone(n),
      });
      const blob = new Blob(parts, { type: "application/json" });
      setFile({ url: URL.createObjectURL(blob), name: backupFileName(now), size: blob.size });
      setPhase("done");
    } catch {
      setPhase(ac.signal.aborted ? "ready" : "error"); // আংশিক ফাইল কখনো দেওয়া হয় না
    }
  }

  const total = counts ? totalDocs(counts) : 0;
  const pct = readPercent(total);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{bn.backup.intro}</p>
      {(phase === "idle" || phase === "error") && (
        <>
          {phase === "error" && (
            <p role="alert" className="text-accent-text">
              {bn.backup.failed}
            </p>
          )}
          <button type="button" onClick={() => void count()} className={btn}>
            {phase === "error" ? bn.backup.retry : bn.backup.countBtn}
          </button>
        </>
      )}
      {phase === "counting" && <p className="text-muted">{bn.backup.counting}</p>}

      {counts && (phase === "ready" || phase === "running" || phase === "done") && (
        <section aria-label={bn.backup.countsLabel} className="rounded-xl bg-bg p-3">
          <ul className="space-y-1">
            {BACKUP_COLLECTIONS.map((c) => (
              <li key={c} className="flex justify-between">
                <span>{bn.backup.col[c]}</span>
                <span>{counts[c]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">
            {bn.backup.estimate(total, pct, DAILY_READ_LIMIT)}
            {pct >= 50 && <strong className="block text-accent-text">{bn.backup.heavy}</strong>}
          </p>
        </section>
      )}

      {phase === "ready" && (
        <ConfirmButton
          label={bn.backup.startBtn}
          question={bn.backup.confirm(total)}
          onConfirm={() => void run()}
          className={btn}
        />
      )}
      {phase === "running" && (
        <div className="space-y-2">
          <p role="status" className="text-muted">
            {bn.backup.running(done, total)}
          </p>
          <button type="button" onClick={() => abort.current?.abort()} className="min-h-11 w-full rounded-full border border-line px-5">
            {bn.backup.cancel}
          </button>
        </div>
      )}
      {phase === "done" && file && (
        <div className="space-y-2">
          <p role="status">{bn.backup.ready(Math.max(1, Math.round(file.size / 1024)))}</p>
          <a href={file.url} download={file.name} className={`${btn} inline-flex items-center justify-center break-all`}>
            ⬇ {file.name}
          </a>
          <p className="text-sm text-muted">{bn.backup.keepSafe}</p>
          <button type="button" onClick={() => void count()} className="block min-h-11 text-accent-text underline">
            {bn.backup.again}
          </button>
        </div>
      )}
    </div>
  );
}
