"use client";

import { useEffect, useState } from "react";
import { readHomeCard, saveHomeCard, type HomeCard } from "@/data/comfortStore";
import { bn } from "@/i18n/bn";

const ROWS: [HomeCard, string][] = [
  ["goal", bn.home.prefGoal],
  ["glance", bn.home.prefGlance],
  ["pick", bn.home.prefPick],
];

/** লাইব্রেরি হোমের কার্ড বন্ধ/চালু — প্রতি-ডিভাইস (localStorage) */
export function HomeCardPrefs() {
  const [on, setOn] = useState<Record<HomeCard, boolean> | null>(null);
  useEffect(() => {
    setOn({ goal: readHomeCard("goal"), glance: readHomeCard("glance"), pick: readHomeCard("pick") });
  }, []);
  if (!on) return null;
  return (
    <fieldset className="mt-10 rounded-2xl border border-line bg-surface p-4">
      <legend className="px-1 font-semibold">{bn.home.prefsTitle}</legend>
      {ROWS.map(([k, label]) => (
        <label key={k} className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={on[k]}
            onChange={(e) => {
              saveHomeCard(k, e.target.checked);
              setOn({ ...on, [k]: e.target.checked });
            }}
            className="size-6 accent-[var(--accent)]"
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
