"use client";

import { saveHomeCard, type HomeCard } from "@/data/comfortStore";
import { Toggle } from "@/components/ui/Toggle";
import { bn } from "@/i18n/bn";
import { useHomeCards } from "../useHomeCards";

const ROWS: [HomeCard, string][] = [
  ["goal", bn.home.prefGoal],
  ["glance", bn.home.prefGlance],
  ["pick", bn.home.prefPick],
  ["daily", bn.home.prefDaily],
];

/** লাইব্রেরি হোমের কার্ড বন্ধ/চালু — প্রতি-ডিভাইস (localStorage) */
export function HomeCardPrefs() {
  const on = useHomeCards();
  if (!on) return null;
  return (
    <fieldset className="mt-10 rounded-2xl border border-line bg-surface p-4">
      <legend className="px-1 font-semibold">{bn.home.prefsTitle}</legend>
      {ROWS.map(([k, label]) => (
        <Toggle key={k} checked={on[k]} onChange={(v) => saveHomeCard(k, v)} label={label} />
      ))}
    </fieldset>
  );
}
