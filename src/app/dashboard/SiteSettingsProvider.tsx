"use client";

// Dashboard-এ সাইট-সেটিং (সময়ক্ষেত্র সব তারিখের ভিত্তি — Arch §৮)। শেষ-জানা মান প্রতি-ডিভাইস cache (prefs) থেকে
// সাথে সাথে বসে, পেছনে ১ read-এ হালনাগাদ — ধীর/অফলাইনে ব্লক বা ব্যর্থ হয় না, defaults-এ ফেরে।
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { prefs } from "@/data/localStore";
import { DEFAULT_SETTINGS, parseSiteSettings, type SiteSettings } from "@/data/siteSettingsRepo";
import { getSiteSettingsRepo } from "@/data/siteSettingsRepo.wire";

const CACHE_KEY = "siteSettings";

function readCache(): SiteSettings {
  try {
    const raw = prefs.get(CACHE_KEY);
    return raw ? parseSiteSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

type Ctx = { settings: SiteSettings; setSettings: (s: SiteSettings) => void };
const SiteSettingsCtx = createContext<Ctx>({ settings: DEFAULT_SETTINGS, setSettings: () => undefined });

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  // AuthGate-এর ভেতরে (client-এ mount-এর পর) বলে lazy-read hydration-নিরাপদ
  const [settings, setState] = useState<SiteSettings>(readCache);

  const setSettings = useMemo(
    () => (s: SiteSettings) => {
      prefs.set(CACHE_KEY, JSON.stringify(s));
      setState(s);
    },
    [],
  );

  useEffect(() => {
    let dead = false;
    getSiteSettingsRepo()
      .then((r) => r.get())
      .then((s) => {
        if (!dead) setSettings(s);
      })
      .catch(() => undefined); // cache/defaults-এই চলে
    return () => {
      dead = true;
    };
  }, [setSettings]);

  const value = useMemo(() => ({ settings, setSettings }), [settings, setSettings]);
  return <SiteSettingsCtx.Provider value={value}>{children}</SiteSettingsCtx.Provider>;
}

export const useSiteSettings = (): Ctx => useContext(SiteSettingsCtx);
/** সাইট-timezone (সব dashboard তারিখ-প্রদর্শনের জন্য) */
export const useSiteTimezone = (): string => useContext(SiteSettingsCtx).settings.timezone;
