"use client";

// P3c-ক: শুধু dry-run — XML পড়ে হিসাব দেখায়, কিছু লেখে না (লেখা P3c-খ-তে)।
import { useState } from "react";
import { getExistingSlugs } from "@/data/importKeys";
import { bn } from "@/i18n/bn";
import { planImport, type ImportPlan } from "@/lib/import/plan";
import { parseWxr } from "./wxrDom";

type Phase = "idle" | "reading" | "done" | "error";
const box = "rounded-2xl border border-line bg-surface p-4";
const t = bn.importWp;

export function ImportPanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [source, setSource] = useState("");
  const [site, setSite] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setPhase("reading");
    setPlan(null);
    let wxr;
    try {
      wxr = parseWxr(await f.text());
    } catch {
      setErr(t.parseError);
      setPhase("error");
      return;
    }
    try {
      const existing = await getExistingSlugs();
      setSite(wxr.siteTitle);
      setPlan(planImport(wxr, { existingSlugs: existing }));
      setPhase("done");
    } catch {
      setErr(t.slugsError);
      setPhase("error");
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
          <p role="status" className="text-sm text-muted">
            {t.noWrite}
          </p>
        </div>
      )}
    </div>
  );
}
