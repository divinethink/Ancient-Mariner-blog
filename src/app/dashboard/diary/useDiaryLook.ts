"use client";

// দিনলিপির চেহারা (ড্যাশবোর্ড): এই ডিভাইসের পছন্দ (localStorage) আগে; না থাকলে সাইট-সেটিংসের মান; তা-ও না থাকলে ডিফল্ট।
import { useCallback, useMemo, useState } from "react";
import { prefs } from "@/data/localStore";
import { lookFromSettings, parseDiaryLook, type DiaryLook } from "@/lib/diaryLook";
import { useSiteSettings } from "../SiteSettingsProvider";

const KEY = "diary:look";

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
  const update = useCallback((l: DiaryLook) => {
    prefs.set(KEY, JSON.stringify(l));
    setOwn(l);
  }, []);
  return { look: own ?? site, site, update };
}
