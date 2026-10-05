"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { triggerSiteRebuild } from "@/data/rebuildClient";
import { SiteSettingsInputSchema, type SiteSettings } from "@/data/siteSettingsRepo";
import { getSiteSettingsRepo } from "@/data/siteSettingsRepo.wire";
import { bn } from "@/i18n/bn";
import { tzLabel } from "@/lib/datetime";
import {
  POSTS_PER_PAGE_RANGE,
  SELECTABLE_THEMES,
  SITE_TITLE_MAX,
  TAGLINE_MAX,
  timezoneChoices,
} from "@/lib/siteSettings";
import { useSiteSettings } from "../SiteSettingsProvider";

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; saved: SiteSettings };
type Errs = Partial<Record<keyof SiteSettings, string>>;

const input = "mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3";
const THEME_LABEL = { auto: bn.settings.themeAuto, light: bn.settings.themeLight, dark: bn.settings.themeDark } as const;

function validate(v: SiteSettings): Errs {
  const r = SiteSettingsInputSchema.safeParse(v);
  if (r.success) return {};
  const msg: Partial<Record<keyof SiteSettings, string>> = {
    siteTitle: bn.settings.errTitle,
    tagline: bn.settings.errTagline,
    postsPerPage: bn.settings.errPosts,
    timezone: bn.settings.errTimezone,
  };
  const errs: Errs = {};
  for (const i of r.error.issues) {
    const k = i.path[0] as keyof SiteSettings;
    errs[k] = msg[k] ?? bn.settings.invalid;
  }
  return errs;
}

export function SettingsForm() {
  const { setSettings } = useSiteSettings();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [draft, setDraft] = useState<SiteSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tick, setTick] = useState(0);

  // লোড ব্যর্থ হলে ফর্ম দেখানো হয় না — defaults দিয়ে আসল সেটিং যেন ভুলে মুছে না যায়
  useEffect(() => {
    let dead = false;
    getSiteSettingsRepo()
      .then((r) => r.get())
      .then((s) => {
        if (dead) return;
        setLoad({ kind: "ready", saved: s });
        setDraft(s);
      })
      .catch(() => {
        if (!dead) setLoad({ kind: "error" });
      });
    return () => {
      dead = true;
    };
  }, [tick]);

  const errs = useMemo(() => (draft ? validate(draft) : {}), [draft]);

  if (load.kind === "loading") {
    return (
      <p role="status" className="text-muted">
        {bn.settings.loading}
      </p>
    );
  }
  if (load.kind === "error" || !draft) {
    return (
      <div role="alert">
        <p className="text-accent-text">{bn.settings.loadFailed}</p>
        <button
          type="button"
          className="mt-3 min-h-11 rounded-full border border-line px-4"
          onClick={() => {
            setLoad({ kind: "loading" });
            setTick((n) => n + 1);
          }}
        >
          {bn.settings.retry}
        </button>
      </div>
    );
  }

  const saved = load.saved;
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const hasErr = Object.keys(errs).length > 0;
  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => {
    setMsg(null);
    setDraft({ ...draft, [k]: v });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !dirty || hasErr || !draft) return; // double-submit নয়
    setBusy(true);
    setMsg(null);
    try {
      const repo = await getSiteSettingsRepo();
      const next = await repo.save(draft);
      setSettings(next);
      setLoad({ kind: "ready", saved: next });
      setDraft(next);
      const ok = await triggerSiteRebuild();
      setMsg({ ok, text: ok ? bn.settings.saved : bn.settings.savedNoRebuild });
    } catch {
      setMsg({ ok: false, text: bn.settings.saveFailed });
    } finally {
      setBusy(false);
    }
  }

  const err = (k: keyof SiteSettings) =>
    errs[k] ? (
      <span id={`err-${k}`} role="alert" className="mt-1 block text-sm text-accent-text">
        {errs[k]}
      </span>
    ) : null;
  const aria = (k: keyof SiteSettings) => ({ "aria-invalid": errs[k] ? true : undefined, "aria-describedby": errs[k] ? `err-${k}` : undefined });

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-8">
      <fieldset className="space-y-4">
        <legend className="mb-2 font-serif text-lg font-bold">{bn.settings.identity}</legend>
        <label className="block">
          {bn.settings.siteTitle}
          <input
            className={input}
            value={draft.siteTitle}
            maxLength={SITE_TITLE_MAX}
            onChange={(e) => set("siteTitle", e.target.value)}
            {...aria("siteTitle")}
          />
          {err("siteTitle")}
        </label>
        <label className="block">
          {bn.settings.tagline}
          <input
            className={input}
            value={draft.tagline}
            maxLength={TAGLINE_MAX}
            onChange={(e) => set("tagline", e.target.value)}
            {...aria("tagline")}
          />
          {err("tagline")}
        </label>
        <div role="radiogroup" aria-label={bn.settings.theme}>
          <p>{bn.settings.theme}</p>
          <p className="text-sm text-muted">{bn.settings.themeHint}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {SELECTABLE_THEMES.map((t) => (
              <label
                key={t}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 has-[:checked]:border-accent has-[:checked]:bg-surface"
              >
                <input
                  type="radio"
                  name="defaultTheme"
                  checked={draft.defaultTheme === t}
                  onChange={() => set("defaultTheme", t)}
                />
                {THEME_LABEL[t as keyof typeof THEME_LABEL]}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-serif text-lg font-bold">{bn.settings.timeDisplay}</legend>
        <label className="block">
          {bn.settings.timezone}
          <select
            className={input}
            value={draft.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            {...aria("timezone")}
          >
            {timezoneChoices(draft.timezone).map((tz) => (
              <option key={tz} value={tz}>
                {tzLabel(tz)}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-sm text-muted">{bn.settings.timezoneHint}</span>
          {err("timezone")}
        </label>
        <label className="block">
          {bn.settings.postsPerPage}
          <input
            className={input}
            type="number"
            inputMode="numeric"
            min={POSTS_PER_PAGE_RANGE.min}
            max={POSTS_PER_PAGE_RANGE.max}
            value={Number.isNaN(draft.postsPerPage) ? "" : draft.postsPerPage}
            onChange={(e) => set("postsPerPage", e.target.value === "" ? NaN : Number(e.target.value))}
            {...aria("postsPerPage")}
          />
          <span className="mt-1 block text-sm text-muted">{bn.settings.postsPerPageHint}</span>
          {err("postsPerPage")}
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-serif text-lg font-bold">{bn.settings.search}</legend>
        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            className="mt-3 size-5"
            checked={draft.allowIndexing}
            onChange={(e) => set("allowIndexing", e.target.checked)}
          />
          <span className="py-2">
            {bn.settings.allowIndexing}
            <span className="block text-sm text-muted">{bn.settings.allowIndexingHint}</span>
          </span>
        </label>
        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            className="mt-3 size-5"
            checked={draft.blockAiCrawlers}
            onChange={(e) => set("blockAiCrawlers", e.target.checked)}
          />
          <span className="py-2">
            {bn.settings.blockAiCrawlers}
            <span className="block text-sm text-muted">{bn.settings.blockAiCrawlersHint}</span>
          </span>
        </label>
      </fieldset>

      <div>
        <button
          type="submit"
          disabled={busy || !dirty || hasErr}
          className="min-h-11 rounded-lg bg-btn-bg px-5 text-btn-tx disabled:opacity-50"
        >
          {busy ? bn.settings.saving : bn.settings.save}
        </button>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={`mt-3 text-sm ${msg.ok ? "text-muted" : "text-accent-text"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </form>
  );
}
