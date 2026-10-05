"use client";

// Migration 001-এর বোতাম (Checklist P3a-২খ): dry-run সংখ্যা → JSON-export নিশ্চিতকরণ → চালান।
// ডেটা-নিরাপত্তা: dry-run কিছু লেখে না; আসল run শুধু ফিল্ড যোগ করে (idempotent); প্রকাশিত লেখা বদলালে rebuild।
import Link from "next/link";
import { useState } from "react";
import { triggerSiteRebuild } from "@/data/rebuildClient";
import { getTaxonomyOps } from "@/data/taxonomyOps.wire";
import { bn } from "@/i18n/bn";

type Phase =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "counted"; missing: number }
  | { kind: "done"; updated: number; failed: number; rebuilt: boolean | null }
  | { kind: "error" };

export function MigrationPanel() {
  const m = bn.org.migration;
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [ack, setAck] = useState(false);

  async function count() {
    if (phase.kind === "busy") return;
    setPhase({ kind: "busy" });
    try {
      const r = await (await getTaxonomyOps()).backfillDefaultCategory({ dryRun: true });
      setAck(false);
      setPhase({ kind: "counted", missing: r.missing });
    } catch {
      setPhase({ kind: "error" });
    }
  }

  async function run() {
    if (phase.kind !== "counted" || !ack) return; // double-submit নয়: busy-তে নামলে আর চলে না
    setPhase({ kind: "busy" });
    try {
      const r = await (await getTaxonomyOps()).backfillDefaultCategory({ dryRun: false });
      const rebuilt = r.publishedAffected > 0 ? await triggerSiteRebuild() : null;
      setPhase({ kind: "done", updated: r.updated, failed: r.failed, rebuilt });
    } catch {
      setPhase({ kind: "error" });
    }
  }

  const busy = phase.kind === "busy";
  return (
    <section aria-labelledby="mig-h" className="rounded-2xl border border-line bg-surface p-4">
      <h2 id="mig-h" className="font-serif text-lg font-bold">
        {m.title}
      </h2>
      <p className="mt-1 text-sm text-muted">{m.intro}</p>

      {(phase.kind === "idle" || phase.kind === "busy" || phase.kind === "error" || phase.kind === "done") && (
        <button
          type="button"
          onClick={() => void count()}
          disabled={busy}
          className="mt-3 min-h-11 rounded-full border border-line px-4 disabled:opacity-50"
        >
          {busy ? m.drying : m.dry}
        </button>
      )}

      {phase.kind === "counted" && phase.missing === 0 && (
        <p role="status" className="mt-3">
          {m.none}
        </p>
      )}
      {phase.kind === "counted" && phase.missing > 0 && (
        <div className="mt-3 space-y-3">
          <p role="status">{m.found(phase.missing)}</p>
          <p className="text-sm text-muted">
            {m.backupFirst}{" "}
            <Link href="/dashboard/backups" className="text-accent-text underline">
              {m.backupLink}
            </Link>
          </p>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            {m.ack}
          </label>
          <button
            type="button"
            onClick={() => void run()}
            disabled={!ack}
            className="min-h-11 rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50"
          >
            {m.run}
          </button>
        </div>
      )}
      {busy && (
        <p role="status" className="mt-3 text-muted">
          {m.running}
        </p>
      )}
      {phase.kind === "done" && (
        <p role="status" className="mt-3">
          {m.done(phase.updated, phase.failed)}
          {phase.rebuilt === true && ` ${bn.org.siteRebuild}`}
          {phase.rebuilt === false && ` ${bn.org.siteRebuildFailed}`}
        </p>
      )}
      {phase.kind === "error" && (
        <p role="alert" className="mt-3 text-accent-text">
          {m.failed}
        </p>
      )}
    </section>
  );
}
