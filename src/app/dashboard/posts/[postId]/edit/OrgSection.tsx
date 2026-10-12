"use client";

// Publish panel-এর 'সংগঠন' সেকশন (Mockup §৭.৯): ধরন, ক্যাটাগরি, ট্যাগ, সিরিজ + পর্ব #।
// state parent-এ (PublishPanel) — সেভ/প্রকাশে `lib/postOrg.orgPatch` দিয়ে শুধু বদলানো ফিল্ড লেখা হয়।
import { useState } from "react";
import type { TermWithId } from "@/data/taxonomyRepo";
import { TERM_NAME_MAX } from "@/data/taxonomyRepo";
import { bn } from "@/i18n/bn";
import { CONTENT_TYPE, type ContentType } from "@/lib/enums";
import { newId } from "@/lib/id";
import { addTag, type OrgState } from "@/lib/postOrg";
import { buildCategoryTree } from "@/lib/taxonomy";

export type OrgOptions = { categories: TermWithId[]; tags: TermWithId[]; series: TermWithId[] };

type Props = {
  value: OrgState;
  onChange: (v: OrgState) => void;
  opts: OrgOptions | "error" | null;
  /** এখনো-না-বানানো নতুন ট্যাগের id (সেভে তৈরি হবে) */
  pending: readonly string[];
  onPending: (ids: string[]) => void;
  /** seriesOrder-এর কাঁচা ইনপুট (parent যাচাই করে) */
  orderInput: string;
  onOrderInput: (v: string) => void;
  published: boolean;
  disabled: boolean;
  onRetry: () => void;
};

const input = "min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base";

export function OrgSection(p: Props) {
  const t = bn.org.panel;
  const [tagIn, setTagIn] = useState("");
  const [tagErr, setTagErr] = useState<string | null>(null);

  if (p.opts === null) return null;
  if (p.opts === "error") {
    return (
      <p role="alert" className="text-sm text-accent-text">
        {t.loadFailed}{" "}
        <button type="button" onClick={p.onRetry} className="min-h-11 underline">
          {t.retry}
        </button>
      </p>
    );
  }
  const { categories, tags, series } = p.opts;
  const v = p.value;

  function addTagNow() {
    if (p.opts === "error" || p.opts === null) return;
    const r = addTag(v.tags, tagIn, p.opts.tags, newId, TERM_NAME_MAX);
    if (!r.ok) {
      if (r.reason === "empty") return;
      setTagErr(r.reason === "dup" ? t.tagDup : r.reason === "limit" ? t.tagLimit : t.tagLong);
      return;
    }
    setTagErr(null);
    setTagIn("");
    p.onChange({ ...v, tags: r.tags });
    if (r.created) p.onPending([...p.pending, r.created.id]);
  }

  function removeTag(id: string) {
    p.onChange({ ...v, tags: v.tags.filter((x) => x.id !== id) });
    p.onPending(p.pending.filter((x) => x !== id));
  }

  return (
    <fieldset className="space-y-4" disabled={p.disabled}>
      <legend className="sr-only">{t.title}</legend>

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-xl border border-line bg-bg px-3 py-1.5 focus-within:border-accent">
          <label htmlFor="org-type" className="block text-xs text-muted">
            {t.type}
          </label>
          <select
            id="org-type"
            className="field-clean min-h-9 w-full bg-transparent text-base"
            value={v.contentType}
            onChange={(e) => p.onChange({ ...v, contentType: e.target.value as ContentType })}
          >
            {CONTENT_TYPE.map((c) => (
              <option key={c} value={c}>
                {bn.org.types[c] ?? c}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 rounded-xl border border-line bg-bg px-3 py-1.5 focus-within:border-accent">
          <label htmlFor="org-cat" className="block text-xs text-muted">
            {t.category}
          </label>
          <select
            id="org-cat"
            className="field-clean min-h-9 w-full bg-transparent text-base"
            value={v.categoryId ?? ""}
            onChange={(e) => {
              const c = categories.find((x) => x.id === e.target.value);
              p.onChange({ ...v, categoryId: c?.id ?? null, categoryName: c?.name ?? null });
            }}
          >
            <option value="">{p.published ? t.noCategoryPublished : t.noCategory}</option>
            {v.categoryId && !categories.some((c) => c.id === v.categoryId) && (
              <option value={v.categoryId}>{v.categoryName || v.categoryId}</option>
            )}
            {buildCategoryTree(categories).map(({ term, depth }) => (
              <option key={term.id} value={term.id}>
                {depth ? "— " : ""}
                {term.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="org-tag" className="mb-1 block text-xs text-muted">
          {t.tags}
        </label>
        {v.tags.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2">
            {v.tags.map((tg) => (
              <li key={tg.id} className="flex items-center rounded-full bg-line pl-3">
                <span className="py-1">
                  #{tg.name}
                  {p.pending.includes(tg.id) && <span className="ml-1 text-xs text-muted">({t.tagNew})</span>}
                </span>
                <button
                  type="button"
                  aria-label={t.tagRemove(tg.name)}
                  onClick={() => removeTag(tg.id)}
                  className="size-10 text-lg"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            id="org-tag"
            className={input}
            list="org-tag-list"
            value={tagIn}
            maxLength={TERM_NAME_MAX + 1}
            placeholder={t.tagInput}
            lang="bn"
            onChange={(e) => {
              setTagIn(e.target.value);
              setTagErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTagNow();
              }
            }}
          />
          <datalist id="org-tag-list">
            {tags.map((x) => (
              <option key={x.id} value={x.name} />
            ))}
          </datalist>
          <button type="button" onClick={addTagNow} className="min-h-11 shrink-0 rounded-full border border-line px-4">
            {t.tagAdd}
          </button>
        </div>
        {tagErr && (
          <p role="alert" className="mt-1 text-sm text-accent-text">
            {tagErr}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <div className="min-w-0 rounded-xl border border-line bg-bg px-3 py-1.5 focus-within:border-accent flex-1">
          <label htmlFor="org-series" className="block text-xs text-muted">
            {t.series}
          </label>
          <select
            id="org-series"
            className="field-clean min-h-9 w-full bg-transparent text-base"
            value={v.seriesId ?? ""}
            onChange={(e) => {
              const id = e.target.value || null;
              if (!id) p.onOrderInput("");
              p.onChange({ ...v, seriesId: id, seriesOrder: id ? v.seriesOrder : null });
            }}
          >
            <option value="">{t.noSeries}</option>
            {v.seriesId && !series.some((s) => s.id === v.seriesId) && <option value={v.seriesId}>{v.seriesId}</option>}
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {v.seriesId && (
          <div className="min-w-0 rounded-xl border border-line bg-bg px-3 py-1.5 focus-within:border-accent w-24 shrink-0">
            <label htmlFor="org-order" className="block text-xs text-muted">
              {t.seriesOrder}
            </label>
            <input id="org-order" className="field-clean min-h-9 w-full bg-transparent text-base" inputMode="numeric" value={p.orderInput} onChange={(e) => p.onOrderInput(e.target.value)} />
          </div>
        )}
      </div>
      <p className="text-xs text-muted">{t.hint}</p>
    </fieldset>
  );
}
