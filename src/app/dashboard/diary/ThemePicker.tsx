"use client";

// ১২ থিমের ছোট রঙের-ফোঁটা গ্রিড (৪ কলাম × ৩ সারি) — 'থিম ও ফন্ট' আর 'ডাউনলোড' দুই শিটেই একই উপাদান।
import { bn } from "@/i18n/bn";
import { DIARY_SWATCH, DIARY_THEMES, type DiaryTheme } from "@/lib/diaryLook";

type Props = { label: string; value: DiaryTheme; onChange: (t: DiaryTheme) => void };

export function ThemePicker({ label, value, onChange }: Props) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-4 gap-x-1 gap-y-2">
      {DIARY_THEMES.map((t) => {
        const on = value === t;
        return (
          <button key={t} type="button" aria-pressed={on} onClick={() => onChange(t)} className="flex min-h-11 flex-col items-center gap-1 rounded-xl px-0.5 py-1">
            <span
              aria-hidden
              className={`flex size-10 items-center justify-center rounded-full border text-base font-bold ${on ? "border-2 border-btn-bg ring-2 ring-btn-bg ring-offset-2 ring-offset-bg" : "border-line"}`}
              style={{ background: DIARY_SWATCH[t].bg, color: DIARY_SWATCH[t].ink }}
            >
              অ
            </span>
            <span className={`line-clamp-2 text-center text-[11px] leading-tight ${on ? "font-semibold" : "text-muted"}`}>{bn.diary.look.themes[t]}</span>
          </button>
        );
      })}
    </div>
  );
}
