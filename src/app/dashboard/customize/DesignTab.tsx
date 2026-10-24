"use client";

// Design ট্যাব (P9b-২): রঙ/ফন্ট/card বাছাই + লোগো/ব্যানার + live preview। preview = `data-accent/font/card` সহ wrapper
// (tokens.css-এর একই নিয়ম, তাই সাইটের সাথে মেলে); desktop-এ পাশাপাশি, মোবাইলে টগল।
import { useState, useSyncExternalStore } from "react";
import type { SiteSettings } from "@/data/siteSettingsRepo";
import { Segmented } from "@/components/ui/Segmented";
import { bn } from "@/i18n/bn";
import { ACCENTS, CARD_STYLES, FONT_PAIRS, PALETTES } from "@/lib/design";
import { CoverPicker } from "../posts/[postId]/edit/CoverPicker";

type Design = SiteSettings["design"];
const t = bn.customize.design;
const noSubscribe = () => () => {};
const readTheme = () => document.documentElement.getAttribute("data-theme") ?? "light";

const heading = "mb-2 font-semibold";

/** প্যালেট-swatch: ব্যাকগ্রাউন্ড-বৃত্তের ভেতরে accent-বিন্দু; রং আসে tokens.css থেকে (data-palette + light/dark) */
function PaletteGrid({ current, theme, onPick }: { current: Design["palette"]; theme: string; onPick: (v: Design["palette"]) => void }) {
  return (
    <div role="group" aria-label={t.palette} className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
      {PALETTES.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={current === v}
          onClick={() => onPick(v)}
          className={`flex min-h-11 items-center gap-2 rounded-2xl border bg-surface px-3 py-2 text-left ${current === v ? "border-accent font-semibold" : "border-line"}`}
        >
          <span aria-hidden="true" data-palette={v} data-theme={theme} className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-bg">
            <span className="size-3 rounded-full bg-accent" />
          </span>
          <span className="min-w-0 text-sm">{t.palettes[v]}</span>
        </button>
      ))}
    </div>
  );
}

/** মূল রঙের swatch-grid: রঙ আসে বিদ্যমান টোকেন থেকে (data-accent + data-theme), নতুন hardcode নয় */
function AccentGrid({ current, theme, onPick }: { current: Design["accent"]; theme: string; onPick: (v: Design["accent"]) => void }) {
  return (
    <div role="group" aria-label={t.accent} className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
      {ACCENTS.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={current === v}
          onClick={() => onPick(v)}
          className={`flex min-h-11 items-center gap-2 rounded-2xl border bg-surface px-3 py-2 text-left ${current === v ? "border-accent font-semibold" : "border-line"}`}
        >
          <span aria-hidden="true" data-accent={v} data-theme={theme} className="size-7 shrink-0 rounded-full border border-line bg-accent" />
          <span className="min-w-0 text-sm">{t.accents[v]}</span>
        </button>
      ))}
    </div>
  );
}

export function DesignTab({ value, onChange }: { value: Design; onChange: (d: Design) => void }) {
  const [preview, setPreview] = useState(false); // শুধু মোবাইলে অর্থবহ
  // বর্তমান থিমেই প্রিভিউ (৫ থিমেই tokens মেলে); effect+setState নয় (lint) — সার্ভার-snapshot "light"
  const theme = useSyncExternalStore(noSubscribe, readTheme, () => "light");
  const set = (p: Partial<Design>) => onChange({ ...value, ...p });
  // প্যালেট শুধু light/dark-এ কাজ করে: sepia/warm → light, amoled → dark হিসেবে দেখাই (classic-এ বর্তমান থিমই)
  const darkish = theme === "dark" || theme === "amoled";
  const pTheme = darkish ? "dark" : "light";
  const previewTheme = value.palette === "classic" ? theme : pTheme;

  return (
    <section className="space-y-4" aria-label={bn.customize.tabDesign}>
      <p className="text-sm text-muted">{t.hint}</p>
      <button
        type="button"
        className="min-h-11 rounded-full border border-line px-4 min-[1024px]:hidden"
        aria-pressed={preview}
        onClick={() => setPreview((p) => !p)}
      >
        {preview ? t.showSettings : t.showPreview}
      </button>
      <div className="min-[1024px]:grid min-[1024px]:grid-cols-2 min-[1024px]:gap-8">
        <div className={`space-y-5 ${preview ? "hidden min-[1024px]:block" : ""}`}>
          <div>
            <h2 className={heading}>{t.palette}</h2>
            <p className="mb-2 text-sm text-muted">{t.paletteHint}</p>
            <PaletteGrid current={value.palette} theme={pTheme} onPick={(palette) => set({ palette })} />
          </div>
          <div>
            <h2 className={heading}>{t.accent}</h2>
            <AccentGrid current={value.accent} theme={theme} onPick={(accent) => set({ accent })} />
          </div>
          <div>
            <h2 className={heading}>{t.font}</h2>
            <Segmented
              label={t.font}
              compact
              value={value.fontPair}
              options={FONT_PAIRS.map((v) => ({ value: v, label: t.fontsShort[v] }))}
              onChange={(fontPair) => set({ fontPair })}
            />
          </div>
          <div>
            <h2 className={heading}>{t.card}</h2>
            <Segmented
              label={t.card}
              compact
              value={value.cardStyle}
              options={CARD_STYLES.map((v) => ({ value: v, label: t.cardsShort[v] }))}
              onChange={(cardStyle) => set({ cardStyle })}
            />
          </div>
          <CoverPicker value={value.logoMediaId || null} onChange={(id) => set({ logoMediaId: id ?? "" })} disabled={false} labels={t.logo} shape="square" />
          <CoverPicker value={value.bannerMediaId || null} onChange={(id) => set({ bannerMediaId: id ?? "" })} disabled={false} labels={t.banner} shape="banner" />
        </div>
        <div className={preview ? "" : "hidden min-[1024px]:block"}>
          <h2 className="mb-2 font-serif text-lg font-bold">{t.previewTitle}</h2>
          <div
            data-theme={previewTheme}
            data-palette={value.palette}
            data-accent={value.accent}
            data-font={value.fontPair}
            data-card={value.cardStyle}
            className="space-y-4 rounded-2xl border border-line bg-bg p-4 text-text"
            style={{ fontFamily: "var(--ff-sans)" }}
          >
            <div className="flex flex-wrap items-center gap-x-4 border-b border-line pb-2">
              <span className="font-serif text-lg font-bold" style={{ fontFamily: "var(--ff-serif)" }}>
                {bn.siteName}
              </span>
              <span>{bn.public.home}</span>
              <span>{bn.public.blog}</span>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4">
              <h3 className="font-serif text-lg font-bold" style={{ fontFamily: "var(--ff-serif)" }}>
                {t.sampleTitle}
              </h3>
              <p className="mt-1 text-sm text-muted">{t.sampleText}</p>
              <span className="mt-3 inline-flex min-h-11 items-center rounded-full bg-btn-bg px-4 font-semibold text-btn-tx">{t.sampleButton}</span>
            </div>
            <span className="inline-flex min-h-11 items-center text-accent-text underline">{t.sampleLink}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
