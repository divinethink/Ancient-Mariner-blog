"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { triggerSiteRebuild } from "@/data/rebuildClient";
import { SiteSettingsInputSchema, type SiteSettings } from "@/data/siteSettingsRepo";
import { getSiteSettingsRepo } from "@/data/siteSettingsRepo.wire";
import { Section } from "@/components/ui/Section";
import { Segmented } from "@/components/ui/Segmented";
import { Toggle } from "@/components/ui/Toggle";
import { bn } from "@/i18n/bn";
import { tzLabel } from "@/lib/datetime";
import {
  AUTHOR_BIO_MAX,
  FEED_ITEMS_RANGE,
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
    authorBio: bn.settings.errAuthorBio,
    feedItems: bn.settings.errFeedItems,
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

  const numField = (k: "postsPerPage" | "feedItems", label: string, hint: string, range: { min: number; max: number }) => (
    <label className="block min-w-0 text-sm">
      {label}
      <input
        className={input}
        type="number"
        inputMode="numeric"
        min={range.min}
        max={range.max}
        value={Number.isNaN(draft[k]) ? "" : draft[k]}
        onChange={(e) => set(k, e.target.value === "" ? NaN : Number(e.target.value))}
        {...aria(k)}
      />
      <span className="mt-1 block text-muted">{hint}</span>
      {err(k)}
    </label>
  );

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
      <Section title={bn.settings.identity} summary={draft.siteTitle} defaultOpen forceOpen={!!(errs.siteTitle || errs.tagline || errs.authorBio)}>
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
        <label className="block">
          {bn.settings.authorBio}
          <textarea
            className={`${input} py-2`}
            rows={3}
            value={draft.authorBio}
            maxLength={AUTHOR_BIO_MAX}
            onChange={(e) => set("authorBio", e.target.value)}
            {...aria("authorBio")}
          />
          <span className="mt-1 block text-sm text-muted">{bn.settings.authorBioHint}</span>
          {err("authorBio")}
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
      </Section>

      <Section title={bn.settings.timeDisplay} summary={tzLabel(draft.timezone)} forceOpen={!!(errs.timezone || errs.postsPerPage || errs.feedItems)}>
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
        <div className="grid grid-cols-2 gap-3">
          {numField("postsPerPage", bn.settings.postsPerPage, bn.settings.postsPerPageHint, POSTS_PER_PAGE_RANGE)}
          {numField("feedItems", bn.settings.feedItems, bn.settings.feedItemsHint, FEED_ITEMS_RANGE)}
        </div>
      </Section>

      <Section title={bn.settings.feed} summary={draft.feedMode === "full" ? bn.settings.feedFull : bn.settings.feedExcerpt}>
        <div>
          <p className="mb-1">{bn.settings.feedMode}</p>
          <Segmented
            label={bn.settings.feedMode}
            value={draft.feedMode}
            options={[
              { value: "full", label: bn.settings.feedFull },
              { value: "excerpt", label: bn.settings.feedExcerpt },
            ]}
            onChange={(m) => set("feedMode", m)}
          />
        </div>
      </Section>

      <Section title={bn.settings.search} summary={draft.allowIndexing ? bn.customize.enabled : bn.customize.off}>
        <Toggle
          checked={draft.allowIndexing}
          onChange={(v) => set("allowIndexing", v)}
          label={bn.settings.allowIndexing}
          hint={bn.settings.allowIndexingHint}
        />
        <Toggle
          checked={draft.blockAiCrawlers}
          onChange={(v) => set("blockAiCrawlers", v)}
          label={bn.settings.blockAiCrawlers}
          hint={bn.settings.blockAiCrawlersHint}
        />
      </Section>

      <div className="pt-2">
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
