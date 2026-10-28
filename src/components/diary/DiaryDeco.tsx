import { bn } from "@/i18n/bn";
import { moonFraction, moonIllumination, moonKind, moonPathD } from "@/lib/moonPhase";
import type { DiaryTheme } from "@/lib/diaryLook";

/** "বিশেষ" থিমের সাজসজ্জা (শুধু দেখার জন্য, aria-hidden)। হুক/state নেই; id-গুলো day-ভিত্তিক (একই day-র জ্যামিতি অভিন্ন, তাই দ্বিরুক্তি নিরাপদ)। */
export function DiaryDeco({ theme, day, dayLabel, year, location, period }: { theme: DiaryTheme; day: string; dayLabel: string; year: string; location?: string; period?: string }) {
  if (theme === "moon") {
    const f = moonFraction(day);
    if (f === null) return null;
    const pct = moonIllumination(f);
    return (
      <div className="ddeco dmoon" aria-hidden="true">
        <span className="dglow" />
        <svg viewBox="0 0 100 100" width="104" height="104">
          <defs>
            <radialGradient id={`mg-${day}`} cx=".4" cy=".35">
              <stop offset="0" stopColor="#fffbe6" />
              <stop offset="1" stopColor="#f1d98a" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="44" fill="#1b1f4f" stroke="#ffffff22" />
          <path d={moonPathD(f)} fill={`url(#mg-${day})`} />
          <circle cx="40" cy="36" r="5" fill="#0001" />
          <circle cx="58" cy="60" r="7" fill="#0001" />
          <circle cx="46" cy="70" r="3.5" fill="#0001" />
        </svg>
        <span className="dmoonlbl">
          {bn.diary.moon[moonKind(f)]} · {bn.diary.moon.light} {pct.toLocaleString("bn-BD", { useGrouping: false })}%
        </span>
      </div>
    );
  }
  if (theme === "postcard") {
    return (
      <div className="ddeco dpost" aria-hidden="true">
        <svg className="dpm" viewBox="0 0 112 112" width="112" height="112">
          <defs>
            <path id={`pa-${day}`} d="M56 56m-42 0a42 42 0 1 1 84 0" />
            <path id={`pb-${day}`} d="M56 56m-42 0a42 42 0 0 0 84 0" />
          </defs>
          <g fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="56" cy="56" r="50" />
            <circle cx="56" cy="56" r="34" />
          </g>
          <text fontSize="11" fill="currentColor" letterSpacing="1.5">
            <textPath href={`#pa-${day}`} startOffset="50%" textAnchor="middle">
              {location ?? bn.diary.postOffice}
            </textPath>
          </text>
          <text fontSize="10" fill="currentColor">
            <textPath href={`#pb-${day}`} startOffset="50%" textAnchor="middle">
              {bn.diary.postOffice} · {year}
            </textPath>
          </text>
          <text x="56" y={period ? 54 : 60} fontSize="12" textAnchor="middle" fill="currentColor">
            {dayLabel}
          </text>
          {period && (
            <text x="56" y="70" fontSize="10" textAnchor="middle" fill="currentColor">
              {period}
            </text>
          )}
        </svg>
        <span className="dstamp">
          <i />
          <b>৳৫</b>
        </span>
        <svg className="dwave" viewBox="0 0 170 16" width="170" height="16">
          <path d="M0 4c10-6 10 6 20 0s10 6 20 0 10 6 20 0 10 6 20 0 10 6 20 0 10 6 20 0 10 6 20 0 10 6 20 0M0 11c10-6 10 6 20 0s10 6 20 0 10 6 20 0 10 6 20 0 10 6 20 0 10 6 20 0 10 6 20 0 10 6 20 0" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </div>
    );
  }
  if (theme === "lantern") {
    return (
      <div className="ddeco dlamp" aria-hidden="true">
        <svg viewBox="0 0 64 96" width="64" height="96">
          <path d="M22 14c0-8 20-8 20 0" fill="none" stroke="#caa36a" strokeWidth="3" />
          <rect x="18" y="14" width="28" height="6" rx="2" fill="#6b4a22" />
          <path d="M20 20h24l4 48H16Z" fill="#ffb35c33" stroke="#caa36a" strokeWidth="2" />
          <path d="M32 30c9 10 8 20 0 26-8-6-9-16 0-26Z" fill="#ffd27a" />
          <path d="M32 42c4 5 3 9 0 12-3-3-4-7 0-12Z" fill="#fff3c9" />
          <rect x="14" y="68" width="36" height="10" rx="3" fill="#6b4a22" />
        </svg>
      </div>
    );
  }
  if (theme === "fog") {
    return (
      <div className="ddeco dfogbox" aria-hidden="true">
        <span className="dfogsun" />
        <svg className="dfogpalm" viewBox="0 0 120 150" width="96" height="120">
          <path d="M58 150c1-30 2-60 6-96" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M62 58c-14-14-30-14-44-6 14-2 28 0 44 6ZM62 58c14-16 32-16 46-8-14-1-30 1-46 8ZM62 54c-4-14-2-26 4-36 0 14 0 24-4 36Z" fill="currentColor" />
          <path d="M48 96h22l-3 20H51Z" fill="currentColor" opacity=".7" />
        </svg>
      </div>
    );
  }
  return null;
}
