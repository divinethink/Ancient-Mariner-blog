"use client";

// Design ট্যাব (P9b-২): রঙ/ফন্ট/card বাছাই + লোগো/ব্যানার + live preview। preview = `data-accent/font/card` সহ wrapper
// (tokens.css-এর একই নিয়ম, তাই সাইটের সাথে মেলে); desktop-এ পাশাপাশি, মোবাইলে টগল।
import { useState, useSyncExternalStore, type ReactNode } from "react";
import type { SiteSettings } from "@/data/siteSettingsRepo";
import { bn } from "@/i18n/bn";
import { ACCENTS, CARD_STYLES, FONT_PAIRS } from "@/lib/design";
import { CoverPicker } from "../posts/[postId]/edit/CoverPicker";

type Design = SiteSettings["design"];
const t = bn.customize.design;
const noSubscribe = () => () => {};
const readTheme = () => document.documentElement.getAttribute("data-theme") ?? "light";

function Group<K extends string>({
  legend,
  name,
  values,
  labels,
  current,
  onPick,
}: {
  legend: string;
  name: string;
  values: readonly K[];
  labels: Record<K, string>;
  current: K;
  onPick: (v: K) => void;
}): ReactNode {
  return (
    <fieldset className="space-y-1">
      <legend className="font-semibold">{legend}</legend>
      {values.map((v) => (
        <label key={v} className="flex min-h-11 items-center gap-3">
          <input type="radio" className="size-5" name={name} checked={current === v} onChange={() => onPick(v)} />
          <span>{labels[v]}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function DesignTab({ value, onChange }: { value: Design; onChange: (d: Design) => void }) {
  const [preview, setPreview] = useState(false); // শুধু মোবাইলে অর্থবহ
  // বর্তমান থিমেই প্রিভিউ (৫ থিমেই tokens মেলে); effect+setState নয় (lint) — সার্ভার-snapshot "light"
  const theme = useSyncExternalStore(noSubscribe, readTheme, () => "light");
  const set = (p: Partial<Design>) => onChange({ ...value, ...p });

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
          <Group legend={t.accent} name="accent" values={ACCENTS} labels={t.accents} current={value.accent} onPick={(accent) => set({ accent })} />
          <Group legend={t.font} name="font" values={FONT_PAIRS} labels={t.fonts} current={value.fontPair} onPick={(fontPair) => set({ fontPair })} />
          <Group legend={t.card} name="card" values={CARD_STYLES} labels={t.cards} current={value.cardStyle} onPick={(cardStyle) => set({ cardStyle })} />
          <CoverPicker value={value.logoMediaId || null} onChange={(id) => set({ logoMediaId: id ?? "" })} disabled={false} labels={t.logo} />
          <CoverPicker value={value.bannerMediaId || null} onChange={(id) => set({ bannerMediaId: id ?? "" })} disabled={false} labels={t.banner} />
        </div>
        <div className={preview ? "" : "hidden min-[1024px]:block"}>
          <h2 className="mb-2 font-serif text-lg font-bold">{t.previewTitle}</h2>
          <div
            data-theme={theme}
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
