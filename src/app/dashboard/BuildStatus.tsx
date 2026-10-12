"use client";

// পাবলিক সাইটের সর্বশেষ build ও হালনাগাদ-অবস্থা + [আবার build করুন] (Arch §১২; Settings, Customize ও Publish panel-এ)
// ধাপ ক: এক লাইনের বার — 'সর্বশেষ build' ও 'হালনাগাদ চলছে/হয়নি' এক বার্তায়।
import { useEffect, useState } from "react";
import { lastRebuildFailure, readRebuildMark, triggerSiteRebuild } from "@/data/rebuildClient";
import { bn } from "@/i18n/bn";
import { buildState } from "@/lib/buildStatus";
import { formatShortDateTime } from "@/lib/datetime";
import { useSiteTimezone } from "./SiteSettingsProvider";

type Snap = { builtAt: number | null; changedAt?: number; now: number };

async function readSnap(): Promise<Snap> {
  let builtAt: number | null = null;
  try {
    const res = await fetch("/build.json", { cache: "no-store" });
    if (res.ok) {
      const t = Date.parse(((await res.json()) as { builtAt?: string }).builtAt ?? "");
      if (!Number.isNaN(t)) builtAt = t;
    }
  } catch {
    // পড়া না গেলে unknown
  }
  return { builtAt, changedAt: await readRebuildMark(), now: Date.now() };
}

export function BuildStatus() {
  const tz = useSiteTimezone();
  const [snap, setSnap] = useState<Snap | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    const tick = () =>
      void readSnap().then((s) => {
        if (!dead) setSnap(s);
      });
    tick();
    const id = setInterval(tick, 20_000); // pending থাকলে নতুন build এলে নিজে থেকেই ok হয়
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, []);

  async function rebuild() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const ok = await triggerSiteRebuild();
    setMsg(ok ? bn.build.requested : `${bn.build.failed} (${lastRebuildFailure()})`);
    setSnap(await readSnap());
    setBusy(false);
  }

  const state = snap ? buildState(snap) : null;
  const when = snap?.builtAt ? `${bn.build.lastBuild}: ${formatShortDateTime(snap.builtAt, tz)}` : snap ? bn.build.unknown : "…";
  return (
    <section
      aria-label={bn.build.label}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-surface px-3 py-1.5"
    >
      <p className="min-w-0 flex-1 basis-40 text-sm text-muted">
        {when}
        {state === "pending" && (
          <>
            {" · "}
            <span role="status" className="text-text">
              {bn.build.pendingShort}
            </span>
          </>
        )}
        {state === "stale" && (
          <>
            {" · "}
            <span role="alert" className="text-accent-text">
              {bn.build.staleShort}
            </span>
          </>
        )}
      </p>
      <button
        type="button"
        onClick={() => void rebuild()}
        disabled={busy}
        className="min-h-11 shrink-0 rounded-full border border-line px-3 text-sm disabled:opacity-50"
      >
        {busy ? bn.build.requesting : bn.build.rebuild}
      </button>
      {msg && (
        <p role="status" className="basis-full pb-1 text-sm text-muted">
          {msg}
        </p>
      )}
    </section>
  );
}
