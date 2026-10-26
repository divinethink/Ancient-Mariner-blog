"use client";

// "থিম ও ফন্ট" bottom-sheet: থিম · ফন্ট · আকার বাছলে সঙ্গে সঙ্গে এই ডিভাইসে প্রযোজ্য; পাবলিক সাইটে প্রযোজ্য করতে আলাদা বোতাম।
import { useEffect, useRef } from "react";
import { bn } from "@/i18n/bn";
import {
  DIARY_FONTS,
  DIARY_SIZES,
  DIARY_SWATCH,
  DIARY_THEMES_CLASSIC,
  DIARY_THEMES_NEW,
  sameLook,
  type DiaryFont,
  type DiaryLook,
  type DiarySize,
  type DiaryTheme,
} from "@/lib/diaryLook";

type Props = {
  look: DiaryLook;
  /** পাবলিক সাইটে এখন যে চেহারা চলছে (বোতাম 'একই' দেখাতে) */
  site: DiaryLook;
  busy: boolean;
  msg: { ok: boolean; text: string } | null;
  onChange: (l: DiaryLook) => void;
  onSaveSite: () => void;
  onClose: () => void;
};

const L = bn.diary.look;
const chip = (on: boolean) => `min-h-11 rounded-full border px-4 text-base ${on ? "border-btn-bg bg-btn-bg text-btn-tx" : "border-line bg-surface"}`;

export function DiaryLookSheet({ look, site, busy, msg, onChange, onSaveSite, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const same = sameLook(look, site);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button type="button" aria-label={L.close} onClick={onClose} className="absolute inset-0 bg-black/40" tabIndex={-1} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={L.title}
        className="relative max-h-[88vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-bg p-5 md:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold">{L.title}</h2>
          <button type="button" onClick={onClose} className="min-h-11 rounded-full border border-line px-4">
            {L.close}
          </button>
        </div>

        <section aria-label={L.theme} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted">{L.theme}</h3>
          {([[L.groupClassic, DIARY_THEMES_CLASSIC], [L.groupNew, DIARY_THEMES_NEW]] as const).map(([label, list]) => (
            <div key={label}>
              <p className="mb-1.5 text-xs text-muted">{label}</p>
              <div className="grid grid-cols-4 gap-2">
                {list.map((t: DiaryTheme) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={look.theme === t}
                    onClick={() => onChange({ ...look, theme: t })}
                    className={`flex min-h-11 flex-col items-center gap-1 rounded-xl border p-1.5 text-xs ${look.theme === t ? "border-2 border-btn-bg" : "border-line"}`}
                  >
                    <span
                      aria-hidden
                      className="flex h-10 w-full items-center justify-center rounded-lg border border-line text-lg font-bold"
                      style={{ background: DIARY_SWATCH[t].bg, color: DIARY_SWATCH[t].ink }}
                    >
                      অ
                    </span>
                    <span className="text-center leading-tight">{L.themes[t]}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section aria-label={L.font}>
          <h3 className="mb-2 text-sm font-semibold text-muted">{L.font}</h3>
          <div className="space-y-2">
            {DIARY_FONTS.map((f: DiaryFont) => (
              <button
                key={f}
                type="button"
                aria-pressed={look.font === f}
                onClick={() => onChange({ ...look, font: f })}
                className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border bg-surface px-3 py-2 text-left ${look.font === f ? "border-2 border-btn-bg" : "border-line"}`}
              >
                <span>
                  <span data-dfont={f} className="dfontpv block text-xl">
                    {L.preview}
                  </span>
                  <span className="block text-sm text-muted">{L.fonts[f]}</span>
                </span>
                {look.font === f && <span aria-hidden>✓</span>}
              </button>
            ))}
          </div>
        </section>

        <section aria-label={L.size}>
          <h3 className="mb-2 text-sm font-semibold text-muted">{L.size}</h3>
          <div className="flex gap-2">
            {DIARY_SIZES.map((s: DiarySize) => (
              <button key={s} type="button" aria-pressed={look.size === s} onClick={() => onChange({ ...look, size: s })} className={`flex-1 ${chip(look.size === s)}`}>
                {L.sizes[s]}
              </button>
            ))}
          </div>
        </section>

        <p className="text-sm text-muted">{L.thisDevice}</p>
        <button
          type="button"
          disabled={busy || same}
          onClick={onSaveSite}
          className="min-h-12 w-full rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50"
        >
          {same ? L.siteSame : L.siteBtn}
        </button>
        {msg && (
          <p role="status" className={`text-sm ${msg.ok ? "text-muted" : "text-accent-text"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
