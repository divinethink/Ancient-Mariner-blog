"use client";

// Drive auto-backup-এর অবস্থা (P5b-২): সর্বশেষ সফল সময়, ৩ দিনের বেশি পুরনো হলে লাল সতর্কতা, [এখনই ব্যাকআপ নিন] (GitHub workflow চালু করে)।
import { useEffect, useState } from "react";
import { readFailure } from "@/data/rebuildClient";
import { getBackupStatusRepo } from "@/data/backupStatusRepo.wire";
import { bn } from "@/i18n/bn";
import { isBackupStale } from "@/lib/backupPolicy";
import { formatDateTime } from "@/lib/datetime";

type State = { kind: "loading" } | { kind: "error" } | { kind: "ok"; at: Date | null };
type Trigger = "idle" | "starting" | "started" | "failed";

export function AutoBackupPanel() {
  const [s, setS] = useState<State>({ kind: "loading" });
  const [t, setT] = useState<Trigger>("idle");
  const [code, setCode] = useState("");
  const t_ = bn.backup.auto;

  useEffect(() => {
    let live = true;
    getBackupStatusRepo()
      .then((r) => r.latest())
      .then((m) => live && setS({ kind: "ok", at: m?.completedAt ?? null }))
      .catch(() => live && setS({ kind: "error" }));
    return () => {
      live = false;
    };
  }, []);

  async function start() {
    if (t === "starting") return;
    setT("starting");
    try {
      const res = await fetch("/api/owner/backup", { method: "POST" });
      if (!res.ok) setCode(await readFailure(res));
      setT(res.ok ? "started" : "failed");
    } catch {
      setCode("network");
      setT("failed");
    }
  }

  const stale = s.kind === "ok" && isBackupStale(s.at ?? undefined, new Date());

  return (
    <section
      aria-label={t_.title}
      className="mb-6 space-y-3 rounded-2xl border border-line bg-surface p-4"
    >
      <h2 className="font-serif text-xl font-bold">{t_.title}</h2>
      <p className="text-sm text-muted">{t_.intro}</p>
      {s.kind === "loading" && <p className="text-muted">{t_.loading}</p>}
      {s.kind === "error" && (
        <p role="alert" className="text-accent-text">
          {t_.loadFailed}
        </p>
      )}
      {s.kind === "ok" && <p className="rounded-xl bg-bg p-3 text-sm">{s.at ? t_.last(formatDateTime(s.at)) : t_.none}</p>}
      {stale && (
        <p
          role="alert"
          className="rounded-xl border border-red-600 p-3 font-semibold text-red-700 dark:text-red-400"
        >
          {t_.stale}
        </p>
      )}
      <button
        type="button"
        onClick={() => void start()}
        disabled={t === "starting"}
        className="min-h-12 w-full rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50"
      >
        {t === "starting" ? t_.starting : t_.now}
      </button>
      {t === "started" && <p role="status">{t_.started}</p>}
      {t === "failed" && (
        <p role="alert" className="text-accent-text">
          {t_.startFailed} {code && <span dir="ltr" className="break-words">({code})</span>}
        </p>
      )}
    </section>
  );
}
