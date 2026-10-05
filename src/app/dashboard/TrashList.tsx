"use client";

import { bn as num } from "@/i18n/bn";
import { ConfirmButton } from "./ConfirmButton";

export type TrashItem = { id: string; title: string; daysLeft: number; wordCount: number };

type Props = {
  items: TrashItem[];
  busy: boolean;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onEmpty: () => void;
};

const ghost = "min-h-11 rounded-full border border-line px-4 disabled:opacity-50";

export function TrashList({ items, busy, onRestore, onDelete, onEmpty }: Props) {
  const t = num.trash;
  if (items.length === 0) return <p className="text-muted">{t.empty}</p>;
  return (
    <>
      <div className="mb-3 flex justify-end">
        <ConfirmButton
          label={t.emptyAll}
          question={t.confirmEmpty}
          onConfirm={onEmpty}
          disabled={busy}
          className={ghost}
        />
      </div>
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.id} className="rounded-2xl border border-line bg-surface p-4">
            <span className="block truncate font-serif text-lg font-bold">{it.title || num.library.untitled}</span>
            <span className="mb-3 block text-sm text-muted">
              {it.daysLeft} {t.daysLeft}
            </span>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => onRestore(it.id)} className={ghost}>
                {t.restore}
              </button>
              <ConfirmButton
                label={t.deleteForever}
                question={t.confirmDelete}
                onConfirm={() => onDelete(it.id)}
                disabled={busy}
                className={ghost}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
