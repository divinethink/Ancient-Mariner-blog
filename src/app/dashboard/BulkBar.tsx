"use client";

import { useState } from "react";
import type { BulkSpec } from "@/data/bulkRun";
import { getTaxonomyRepo } from "@/data/taxonomyRepo.wire";
import type { TermWithId } from "@/data/taxonomyRepo";
import { bn } from "@/i18n/bn";
import { countApplicable, type BulkKind } from "@/lib/bulk";
import type { PostStatus } from "@/lib/enums";
import { buildCategoryTree } from "@/lib/taxonomy";

type Props = {
  /** নির্বাচিত লেখাগুলোর অবস্থা (প্রযোজ্যতার সংখ্যা-গণনার জন্য) */
  statuses: PostStatus[];
  allSelected: boolean;
  trashView: boolean;
  busy: boolean;
  progress: { d: number; t: number } | null;
  onToggleAll: () => void;
  onExit: () => void;
  onRun: (spec: BulkSpec) => void;
};

type Pending = { spec: BulkSpec; question: (n: number) => string; strong?: boolean };
type Picker = {
  kind: "category" | "series";
  terms: TermWithId[] | null | "failed";
  chosen: string;
};

const btn = "min-h-11 rounded-full border border-line px-4 text-sm disabled:opacity-50";
const solid = "min-h-11 rounded-full bg-btn-bg px-4 text-sm text-btn-tx disabled:opacity-50";
const B = bn.bulk;

/** Library select-mode-এর নিচের action-bar (Mockup §৭.৬): প্রতিটা ক্রিয়ায় সংখ্যাসহ নিশ্চিতকরণ, তারপর কাজ */
export function BulkBar({
  statuses,
  allSelected,
  trashView,
  busy,
  progress,
  onToggleAll,
  onExit,
  onRun,
}: Props) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [more, setMore] = useState(false);
  const count = statuses.length;
  const none = count === 0;

  const ask = (spec: BulkSpec, question: Pending["question"], strong = false) => {
    setMore(false);
    setPicker(null);
    setPending({ spec, question, strong });
  };

  async function openPicker(kind: "category" | "series") {
    setMore(false);
    setPending(null);
    setPicker({ kind, terms: null, chosen: "" });
    try {
      const terms = await (
        await getTaxonomyRepo(kind === "category" ? "categories" : "series")
      ).list();
      setPicker((p) => (p && p.kind === kind ? { ...p, terms } : p));
    } catch {
      setPicker((p) => (p && p.kind === kind ? { ...p, terms: "failed" } : p));
    }
  }

  function confirmPick() {
    if (!picker || !Array.isArray(picker.terms)) return;
    const t = picker.terms.find((x) => x.id === picker.chosen);
    if (!t) return;
    if (picker.kind === "category")
      ask({ kind: "category", id: t.id, name: t.name }, (n) => B.confirm.category(n, t.name));
    else ask({ kind: "series", id: t.id, name: t.name }, (n) => B.confirm.series(n, t.name));
  }

  const applicable = (spec: BulkSpec) => countApplicable(spec.kind as BulkKind, statuses);

  const pendingN = pending ? applicable(pending.spec) : 0;
  const menu: [string, BulkSpec, Pending["question"]][] = [
    [B.act.unpublish, { kind: "unpublish" }, B.confirm.unpublish],
    [B.act.makePrivate, { kind: "visibility", to: "private" }, B.confirm.private],
    [B.act.makePublic, { kind: "visibility", to: "public" }, B.confirm.public],
    [B.act.archive, { kind: "archive" }, B.confirm.archive],
    [B.act.trash, { kind: "trash" }, B.confirm.trash],
  ];

  return (
    <div
      role="region"
      aria-label={B.barLabel}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] lg:left-[var(--nav-w,0px)]"
    >
      <div className="mx-auto max-w-3xl space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={B.close}
            onClick={onExit}
            disabled={busy}
            className="min-h-11 min-w-11 rounded-full text-xl"
          >
            ✕
          </button>
          <span className="flex-1 text-sm font-semibold" aria-live="polite">
            {B.selected(count)}
          </span>
          <button type="button" onClick={onToggleAll} disabled={busy} className={btn}>
            {allSelected ? B.selectNone : B.selectAll}
          </button>
        </div>

        {busy && (
          <p role="status" className="text-sm text-muted">
            {progress ? B.progress(progress.d, progress.t) : B.running}
          </p>
        )}

        {!busy && pending && (
          <div
            role="alertdialog"
            aria-label={pending.question(pendingN)}
            className="space-y-2 rounded-xl border border-line p-3 text-sm"
          >
            {pendingN === 0 ? (
              <>
                <p>{B.confirm.none}</p>
                <button type="button" onClick={() => setPending(null)} className={btn}>
                  {B.confirm.ok}
                </button>
              </>
            ) : (
              <>
                <p>
                  {pending.question(pendingN)}
                  {pendingN < count && B.confirm.rest(count - pendingN)}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const spec = pending.spec;
                      setPending(null);
                      onRun(spec);
                    }}
                    className={solid}
                  >
                    {pending.strong ? B.confirm.yesDelete : B.confirm.yes}
                  </button>
                  <button type="button" onClick={() => setPending(null)} className={btn}>
                    {B.confirm.no}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {!busy && picker && (
          <div className="space-y-2 rounded-xl border border-line p-3 text-sm">
            {picker.terms === null ? (
              <p role="status" className="text-muted">
                {bn.org.loading}
              </p>
            ) : picker.terms === "failed" ? (
              <p role="alert" className="text-accent-text">
                {B.termsFailed}{" "}
                <button
                  type="button"
                  onClick={() => void openPicker(picker.kind)}
                  className="min-h-11 underline"
                >
                  {bn.library.retry}
                </button>
              </p>
            ) : picker.terms.length === 0 ? (
              <p className="text-muted">
                {picker.kind === "category" ? B.noCategories : B.noSeries}
              </p>
            ) : (
              <div className="flex gap-2">
                <select
                  aria-label={picker.kind === "category" ? B.pickCategory : B.pickSeries}
                  value={picker.chosen}
                  onChange={(e) => setPicker({ ...picker, chosen: e.target.value })}
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3"
                >
                  <option value="">
                    {picker.kind === "category" ? B.pickCategory : B.pickSeries}
                  </option>
                  {picker.kind === "category"
                    ? buildCategoryTree(picker.terms).map(({ term, depth }) => (
                        <option key={term.id} value={term.id}>
                          {depth ? "— " : ""}
                          {term.name}
                        </option>
                      ))
                    : picker.terms.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                </select>
                <button
                  type="button"
                  disabled={!picker.chosen}
                  onClick={confirmPick}
                  className={solid}
                >
                  {B.confirm.ok}
                </button>
              </div>
            )}
            <button type="button" onClick={() => setPicker(null)} className={btn}>
              {B.confirm.no}
            </button>
          </div>
        )}

        <div className="relative flex flex-wrap gap-2">
          {trashView ? (
            <>
              <button
                type="button"
                disabled={busy || none}
                onClick={() => ask({ kind: "restore" }, B.confirm.restore)}
                className={btn}
              >
                {B.act.restore}
              </button>
              <button
                type="button"
                disabled={busy || none}
                onClick={() => ask({ kind: "deleteForever" }, B.confirm.deleteForever, true)}
                className={btn}
              >
                {B.act.deleteForever}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || none}
                onClick={() => ask({ kind: "publish" }, B.confirm.publish)}
                className={solid}
              >
                {B.act.publish}
              </button>
              <button
                type="button"
                disabled={busy || none}
                onClick={() => void openPicker("category")}
                className={btn}
              >
                {B.act.category}
              </button>
              <button
                type="button"
                disabled={busy || none}
                onClick={() => void openPicker("series")}
                className={btn}
              >
                {B.act.series}
              </button>
              <button
                type="button"
                aria-label={B.more}
                aria-expanded={more}
                disabled={busy || none}
                onClick={() => setMore((m) => !m)}
                className={`${btn} text-xl`}
              >
                ⋯
              </button>
              {more && (
                <ul className="absolute bottom-12 right-0 z-10 min-w-48 rounded-xl border border-line bg-surface p-1 shadow">
                  {menu.map(([label, spec, q]) => (
                    <li key={label}>
                      <button
                        type="button"
                        onClick={() => ask(spec, q)}
                        className="min-h-11 w-full rounded-lg px-4 text-left text-sm hover:bg-line"
                      >
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
