// Privileged allowlist ৩ (Arch §২) — Cron: সময়-হওয়া `scheduled` লেখা `published` করা (P11c-১)।
// query শুধু `status=="scheduled"` (single-field index; নতুন index নয়); সময়ের হিসাব `lib/schedule.ts`-এ। body কখনো পড়া হয় না।
import { MAX_PUBLISH_PER_RUN, selectDue } from "../../lib/schedule";
import type { AdminDb } from "./firestoreAdmin";

type Log = { info: (m: string, c?: Record<string, unknown>) => void; warn: (m: string, c?: Record<string, unknown>) => void };

const SCAN_LIMIT = 200;

export type PublishDueResult = { scanned: number; due: number; published: number; skipped: number };

export async function publishDue(db: AdminDb, nowMs: number, log: Log): Promise<PublishDueResult> {
  const { docs } = await db.runQuery({
    from: [{ collectionId: "posts" }],
    where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "scheduled" } } },
    select: { fields: [{ fieldPath: "status" }, { fieldPath: "scheduledAt" }] },
    limit: SCAN_LIMIT,
  });
  const rows = docs.map((d) => ({
    id: d.id,
    updateTime: d.updateTime,
    scheduledAt: d.data.scheduledAt instanceof Date ? d.data.scheduledAt : undefined,
  }));
  const due = selectDue(rows, nowMs, MAX_PUBLISH_PER_RUN);
  const out: PublishDueResult = { scanned: docs.length, due: due.length, published: 0, skipped: 0 };
  for (const r of due) {
    if (!r.updateTime) {
      out.skipped++;
      continue;
    }
    // publishedAt = নির্ধারিত সময় (তালিকার ক্রম অনুমানযোগ্য); ব্যর্থ হলে পরের চালনায় আবার
    const res = await db.commitPublish({ id: r.id, ifUpdateTime: r.updateTime, publishedAt: r.scheduledAt!, nowMs });
    if (res === "ok") out.published++;
    else {
      out.skipped++;
      log.warn("cron.publishDue.precondition", { id: r.id });
    }
  }
  return out;
}
