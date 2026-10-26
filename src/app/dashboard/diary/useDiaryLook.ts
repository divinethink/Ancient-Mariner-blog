"use client";

// দিনলিপির চেহারা (ড্যাশবোর্ড): এই ডিভাইসের পছন্দ (localStorage) আগে; না থাকলে সাইট-সেটিংসের মান; তা-ও না থাকলে ডিফল্ট।
import { useCallback, useMemo, useState } from "react";
import { dayKey } from "@/lib/datetime";
import { prefs } from "@/data/localStore";
import { lookFromSettings, parseDiaryLook, type DiaryLook } from "@/lib/diaryLook";
import { DEFAULT_SEASON_PREF, parseSeasonPref, seasonOf, themeFor, type Season, type SeasonPref } from "@/lib/diarySeason";
import type { DiaryTheme } from "@/lib/diaryLook";
import { useSiteSettings } from "../SiteSettingsProvider";

const KEY = "diary:look";
const SKEY = "diary:season";

function readSeason(): SeasonPref {
  try {
    const raw = prefs.get(SKEY);
    return raw ? parseSeasonPref(JSON.parse(raw)) : DEFAULT_SEASON_PREF;
  } catch {
    return DEFAULT_SEASON_PREF;
  }
}

function readOwn(): DiaryLook | null {
  try {
    const raw = prefs.get(KEY);
    return raw ? parseDiaryLook(JSON.parse(raw)) : null;
  } catch {
    return null; // নষ্ট JSON ⇒ সাইটের মান
  }
}

export function useDiaryLook() {
  const { settings } = useSiteSettings();
  const site = useMemo(() => lookFromSettings(settings), [settings]);
  const [own, setOwn] = useState<DiaryLook | null>(readOwn); // AuthGate-এর ভেতরে (client-only) তাই lazy-read নিরাপদ
  const [seasonPref, setSeasonPref] = useState<SeasonPref>(readSeason);
  const [nowMs] = useState(() => Date.now()); // render-এ impure call নয়; পেজ-খোলার মুহূর্তের 'আজ'
  const today = useMemo(() => dayKey(nowMs, settings.timezone), [nowMs, settings.timezone]);
  const base = own ?? site;
  const look = useMemo(() => ({ ...base, theme: themeFor(seasonPref, base.theme, today) }), [base, seasonPref, today]);
  const update = useCallback(
    (l: DiaryLook) => {
      // ঋতু-থিম চালু থাকলে নতুন থিম-বাছাই = আজকের ঋতুর থিম; ফন্ট/আকার আগের মতোই
      const s = seasonPref.on ? seasonOf(today) : null;
      if (s && l.theme !== look.theme) {
        const next = { ...seasonPref, map: { ...seasonPref.map, [s]: l.theme } };
        prefs.set(SKEY, JSON.stringify(next));
        setSeasonPref(next);
        const keep = { ...l, theme: base.theme };
        prefs.set(KEY, JSON.stringify(keep));
        setOwn(keep);
        return;
      }
      const keep = s ? { ...l, theme: base.theme } : l;
      prefs.set(KEY, JSON.stringify(keep));
      setOwn(keep);
    },
    [seasonPref, today, look.theme, base.theme],
  );
  const setSeason = useCallback((next: SeasonPref) => {
    prefs.set(SKEY, JSON.stringify(next));
    setSeasonPref(next);
  }, []);
  const setSeasonTheme = useCallback((s: Season, t: DiaryTheme) => setSeason({ ...seasonPref, map: { ...seasonPref.map, [s]: t } }), [seasonPref, setSeason]);
  return { look, site, update, season: { pref: seasonPref, current: seasonOf(today), setOn: (on: boolean) => setSeason({ ...seasonPref, on }), setTheme: setSeasonTheme } };
}
