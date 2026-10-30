"use client";

// "থিম ও ফন্ট" bottom-sheet: থিম · ফন্ট · আকার বাছলে সঙ্গে সঙ্গে এই ডিভাইসে প্রযোজ্য; পাবলিক সাইটে প্রযোজ্য করতে নিচের স্থায়ী বোতাম।
import { Segmented } from "@/components/ui/Segmented";
import { bn } from "@/i18n/bn";
import { DIARY_FONTS, DIARY_SIZES, sameLook, type DiaryFont, type DiaryLook, type DiarySize } from "@/lib/diaryLook";
import { DiarySheet } from "./DiarySheet";
import { ThemePicker } from "./ThemePicker";

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

export function DiaryLookSheet({ look, site, busy, msg, onChange, onSaveSite, onClose }: Props) {
  const same = sameLook(look, site);
  return (
    <DiarySheet
      title={L.title}
      closeLabel={L.close}
      onClose={onClose}
      footer={
        <>
          {msg && (
            <p role="status" className={`text-sm ${msg.ok ? "text-muted" : "text-accent-text"}`}>
              {msg.text}
            </p>
          )}
          <button
            type="button"
            disabled={busy || same}
            onClick={onSaveSite}
            className="min-h-12 w-full rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50"
          >
            {same ? L.siteSame : L.siteBtn}
          </button>
          <p className="text-center text-xs text-muted">{L.thisDevice}</p>
        </>
      }
    >
      <section aria-label={L.theme}>
        <h3 className="mb-2 text-sm font-semibold text-muted">{L.theme}</h3>
        <ThemePicker label={L.theme} value={look.theme} onChange={(theme) => onChange({ ...look, theme })} />
      </section>

      <section aria-label={L.font}>
        <h3 className="mb-2 text-sm font-semibold text-muted">{L.font}</h3>
        <div className="space-y-1.5">
          {DIARY_FONTS.map((f: DiaryFont) => (
            <button
              key={f}
              type="button"
              aria-pressed={look.font === f}
              onClick={() => onChange({ ...look, font: f })}
              className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border bg-surface px-3 py-1 text-left ${look.font === f ? "border-2 border-btn-bg" : "border-line"}`}
            >
              <span data-dfont={f} className="dfontpv min-w-0 flex-1 truncate text-lg">
                {L.preview}
              </span>
              <span className="shrink-0 text-xs text-muted">{L.fonts[f]}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-label={L.size}>
        <h3 className="mb-2 text-sm font-semibold text-muted">{L.size}</h3>
        <Segmented<DiarySize> label={L.size} value={look.size} options={DIARY_SIZES.map((s) => ({ value: s, label: L.sizes[s]! }))} onChange={(size) => onChange({ ...look, size })} />
      </section>
    </DiarySheet>
  );
}
