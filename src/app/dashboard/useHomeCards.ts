"use client";

import { useSyncExternalStore } from "react";
import { HOME_CARDS_EVENT, readHomeCard, type HomeCard } from "@/data/comfortStore";

export type HomeCardState = Record<HomeCard, boolean>;

// প্রিমিটিভ snapshot (স্থিতিশীল তুলনা); server-এ null → hydration মিল থাকে, mount-এর পর পছন্দ আসে
const snapshot = () => (["goal", "glance", "pick"] as const).map((c) => (readHomeCard(c) ? "1" : "0")).join("");
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(HOME_CARDS_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(HOME_CARDS_EVENT, cb);
  };
};

/** লাইব্রেরি হোমের কার্ড-পছন্দ (প্রতি-ডিভাইস); SSR-এ null */
export function useHomeCards(): HomeCardState | null {
  const s = useSyncExternalStore(subscribe, snapshot, () => null);
  return s === null ? null : { goal: s[0] === "1", glance: s[1] === "1", pick: s[2] === "1" };
}
