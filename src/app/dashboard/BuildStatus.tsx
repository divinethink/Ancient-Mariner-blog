"use client";

// পাবলিক সাইটের সর্বশেষ build ও হালনাগাদ-অবস্থা + [আবার build করুন] (Arch §১২; Settings ও Publish panel-এ)
import { useEffect, useState } from "react";
import { readRebuildMark, triggerSiteRebuild } from "@/data/rebuildClient";
import { bn } from "@/i18n/bn";
import { buildState } from "@/lib/buildStatus";
import { formatDateTime } from "@/lib/datetime";
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
    setMsg(ok ? bn.build.requested : bn.build.failed);
    setSnap(await readSnap());
    setBusy(false);
  }

  const state = snap ? buildState(snap) : null;
  return (
    <section aria-label={bn.build.label} className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-serif text-lg font-bold">{bn.build.label}</h2>
      <p className="mt-1 text-sm text-muted">
        {snap?.builtAt ? `${bn.build.lastBuild}: ${formatDateTime(snap.builtAt, tz)}` : snap ? bn.build.unknown : "…"}
      </p>
      {state === "pending" && (
        <p role="status" className="mt-2 text-sm">
          {bn.build.pending}
        </p>
      )}
      {state === "stale" && (
        <p role="alert" className="mt-2 text-sm text-accent-text">
          {bn.build.stale}
        </p>
      )}
      {msg && (
        <p role="status" className="mt-2 text-sm text-muted">
          {msg}
        </p>
      )}
      <button
        type="button"
        onClick={() => void rebuild()}
        disabled={busy}
        className="mt-3 min-h-11 rounded-full border border-line px-4 disabled:opacity-50"
      >
        {busy ? bn.build.requesting : bn.build.rebuild}
      </button>
    </section>
  );
}
