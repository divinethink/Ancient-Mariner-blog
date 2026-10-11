"use client";

import { bn } from "@/i18n/bn";
import { PROJECT_TYPE, PROJECT_TYPE_MAX } from "@/lib/enums";
import { TYPE_OTHER } from "@/lib/projectType";

const field = "w-full rounded-lg border border-line bg-surface px-3 text-base min-h-11";

/** ধরন: প্রিসেট তালিকা + শেষে '✏️ নতুন ধরন লিখুন…' (বাছলে নিজের নামের বক্স খোলে) */
export function ProjectTypeField(props: { select: string; custom: string; onSelect: (v: string) => void; onCustom: (v: string) => void }) {
  const t = bn.projects;
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-sm text-muted">{t.typeLabel}</span>
        <select value={props.select} onChange={(e) => props.onSelect(e.target.value)} className={field}>
          {PROJECT_TYPE.map((x) => (
            <option key={x} value={x}>
              {t.types[x]}
            </option>
          ))}
          <option value={TYPE_OTHER}>{t.typeOther}</option>
        </select>
      </label>
      {props.select === TYPE_OTHER && (
        <label className="block">
          <span className="mb-1 block text-sm text-muted">{t.typeCustomLabel}</span>
          <input
            value={props.custom}
            maxLength={PROJECT_TYPE_MAX}
            placeholder={t.typeCustomPlaceholder}
            onChange={(e) => props.onCustom(e.target.value)}
            className={field}
          />
        </label>
      )}
    </div>
  );
}
