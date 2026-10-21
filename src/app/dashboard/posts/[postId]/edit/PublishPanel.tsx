"use client";

// Publish/Metadata panel (Mockup §৭.৯): mobile = bottom-sheet, ≥md = ডান ড্রয়ার।
// সব রিমোট-লেখা `engine.exclusive`-এর ভেতরে (sync-এর সাথে ক্রমানুসারে); প্রতিটা ক্রিয়ার পর রিমোট পড়ে base বসানো।
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { draftStore } from "@/data/draftStore";
import { triggerSiteRebuild } from "@/data/rebuildClient";
import { snapshotOnPublish } from "@/data/revisionHooks";
import { MAX_LOCATION, PostNotFoundError, SlugTakenError, type PostRepo, type PostWithId } from "@/data/postRepo";
import { getTaxonomyOps } from "@/data/taxonomyOps.wire";
import { getTaxonomyRepo } from "@/data/taxonomyRepo.wire";
import { bn } from "@/i18n/bn";
import { formatLongDateTime, toZonedInput } from "@/lib/datetime";
import { sameIds } from "@/lib/gallery";
import { blogPath } from "@/lib/publicSite";
import { COVER_FOCUS, COVER_RATIOS, sameCrop, type CoverCrop, type CoverFocus, type CoverRatio } from "@/lib/coverCrop";
import { Segmented } from "@/components/ui/Segmented";
import { orgFromPost, orgPatch, parseSeriesOrder, type OrgState } from "@/lib/postOrg";
import { parsePublishDate } from "@/lib/publish";
import { parseScheduleInput } from "@/lib/schedule";
import type { PostVisibility } from "@/lib/enums";
import { useSiteTimezone } from "../../../SiteSettingsProvider";
import { autoSlugBase, withSuffix } from "@/lib/slug";
import type { SyncStatus } from "@/data/syncEngine";
import { CoverPicker } from "./CoverPicker";
import { GalleryPicker } from "./GalleryPicker";
import { OrgSection, type OrgOptions } from "./OrgSection";
import type { PubInfo, SyncEngine } from "./useRemoteSync";

type Props = {
  /** ≥১২০০px: ডানে docked (modal নয়; backdrop/Esc-বন্ধ নেই) */
  docked?: boolean;
  /** parent শুধু খোলা অবস্থায় mount করে (প্রতিবার নতুন state) */
  onClose: () => void;
  postId: string;
  engine: SyncEngine;
  status: SyncStatus;
  excerpt: string;
  onExcerpt: (v: string) => void;
  onPub: (p: PubInfo) => void;
  /** লোকাল ড্রাফটের শেষ সম্পাদনা IndexedDB-তে নামা পর্যন্ত অপেক্ষা */
  flushLocal: () => Promise<void>;
  /** রিমোটের লেখা আনতে (লোকাল ড্রাফট মুছে রিলোড) */
  onDiscarded: () => Promise<void>;
};

type Meta = { post: PostWithId; hasDraft: boolean };
type Msg = { kind: "ok" | "err"; text: string } | null;

/** event-handler-এর ভেতরের "এখন" — render-purity lint এড়াতে আলাদা (render-এ কখনো ডাকা হয় না) */
const nowMs = () => Date.now();

const input = "min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base";
const btnPrimary = "min-h-11 rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50";
const btnGhost = "min-h-11 rounded-full border border-line px-4 disabled:opacity-50";

export function PublishPanel(p: Props) {
  const { onClose, postId, engine, status } = p;
  const tz = useSiteTimezone();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [vis, setVis] = useState<PostVisibility>("public");
  const [coverOpen, setCoverOpen] = useState(false);
  const [dateIn, setDateIn] = useState("");
  const [feat, setFeat] = useState(false);
  const [commentsOn, setCommentsOn] = useState(true);
  const [coverIn, setCoverIn] = useState<string | null>(null);
  const [cropIn, setCropIn] = useState<CoverCrop | null>(null);
  const [galleryIn, setGalleryIn] = useState<string[]>([]);
  const [placeIn, setPlaceIn] = useState("");
  /** প্রকাশের তারিখের `max` — render-এ Date.now() নয়, meta লোডের সময় বসে */
  const [maxIn, setMaxIn] = useState("");
  const [org, setOrg] = useState<OrgState | null>(null);
  const [orderIn, setOrderIn] = useState("");
  /** এখনো-না-বানানো নতুন ট্যাগের id — সেভে তৈরি হয় (id আগে থেকে ঠিক ⇒ retry-তে duplicate নয়) */
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [orgOpts, setOrgOpts] = useState<OrgOptions | "error" | null>(null);
  const [optsTick, setOptsTick] = useState(0);
  const { flushLocal } = p;

  const { onPub } = p;
  const applyMeta = useCallback(
    (post: PostWithId, hasDraft: boolean) => {
      setMeta({ post, hasDraft });
      // কখনো প্রকাশ না-হওয়া লেখায় প্রকাশের পথে Public শুরুর মান; নইলে বর্তমান
      setVis(post.publishedAt || post.status === "scheduled" ? post.visibility : "public");
      // একটাই তারিখ-ঘর: নির্ধারিত লেখায় নির্ধারিত সময়, নইলে প্রকাশের তারিখ
      setDateIn(post.status === "scheduled" && post.scheduledAt ? toZonedInput(post.scheduledAt, tz) : post.publishedAt ? toZonedInput(post.publishedAt, tz) : "");
      setFeat(post.featured === true);
      setCommentsOn(post.commentsEnabled !== false);
      setCoverIn(post.coverMediaId ?? null);
      setCropIn(post.coverCrop ?? null);
      setGalleryIn(post.gallery ?? []);
      setPlaceIn(post.location ?? "");
      setMaxIn(toZonedInput(new Date(), tz));
      setOrg(orgFromPost(post));
      setOrderIn(post.seriesId && post.seriesOrder !== undefined ? String(post.seriesOrder) : "");
      setPendingTags([]);
      onPub({ status: post.status === "published" ? "published" : "draft", hasUnpublished: hasDraft });
    },
    [onPub, tz],
  );

  /** রিমোট পড়ে meta বসানো + base হালনাগাদ (নিজের লেখা যেন পরের sync-এ conflict না হয়) */
  const refresh = useCallback(
    async (repo: PostRepo) => {
      const post = await repo.get(postId);
      if (!post) throw new PostNotFoundError(postId);
      const d = post.status === "published" ? await repo.getDraft(postId) : null;
      await engine.adoptBase(Math.max(post.updatedAt.getTime(), d?.updatedAt.getTime() ?? 0));
      applyMeta(post, !!d);
    },
    [engine, postId, applyMeta],
  );

  /** লোড করে ফল ফেরত দেয় (state বসানো কলারের callback-এ) */
  const load = useCallback(async (): Promise<"ready" | "empty" | "error"> => {
    try {
      await flushLocal();
      await engine.syncNow(); // নতুন লেখা এখানেই Firestore-এ তৈরি হয়
      const found = await engine.exclusive(async (repo) => {
        const post = await repo.get(postId);
        if (!post) return false;
        await refresh(repo);
        return true;
      });
      return found ? "ready" : "empty";
    } catch {
      return "error";
    }
  }, [engine, postId, refresh, flushLocal]);

  const retry = useCallback(() => {
    setState("loading");
    setMsg(null);
    void load().then(setState);
  }, [load]);

  useEffect(() => {
    void load().then(setState); // mount-এ state আগে থেকেই "loading"
  }, [load]);

  // সংগঠনের বিকল্প (ক্যাটাগরি/ট্যাগ/সিরিজ) panel তৈরি হওয়ার পর একবার; ব্যর্থ হলে সংগঠন-সেকশন বাদে বাকি panel চলে
  useEffect(() => {
    if (state !== "ready") return;
    let dead = false;
    Promise.all([getTaxonomyRepo("categories"), getTaxonomyRepo("tags"), getTaxonomyRepo("series")])
      .then(([c, t, s]) => Promise.all([c.list(), t.list(), s.list()]))
      .then(([categories, tags, series]) => {
        if (!dead) setOrgOpts({ categories, tags, series });
      })
      .catch(() => {
        if (!dead) setOrgOpts("error");
      });
    return () => {
      dead = true;
    };
  }, [state, optsTick]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !p.docked && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [state, onClose, p.docked]);

  /** visibility/publishedAt ইত্যাদি যা বদলেছে তা লেখা; ব্যর্থ হলে Error throw (বার্তা ফেরত) */
  async function writeMeta(
    repo: PostRepo,
    extra: { status?: "published" | "draft" | "scheduled"; scheduledAt?: Date | null } = {},
    opts: { defaultCategory?: boolean; autoSlug?: boolean } = {},
  ) {
    if (!meta) return;
    const cur = meta.post;
    let date = parsePublishDate(dateIn, nowMs(), tz);
    // প্রকাশিত নয় এমন লেখায় ভবিষ্যৎ তারিখ = নির্ধারণের সময় (publishedAt নয়) — সেটা onSchedule সামলায়
    if (!date.ok && date.reason === "future" && cur.status !== "published") date = { ok: true, date: undefined };
    if (!date.ok) throw new Error(date.reason);
    // slug স্বয়ংক্রিয়: শুধু কখনো-প্রকাশ-না-হওয়া লেখার প্রথম প্রকাশ/সময়-নির্ধারণে শিরোনাম থেকে; একবার প্রকাশের পর কখনো বদলায় না (লিংক ভাঙে না)
    if (opts.autoSlug && !cur.publishedAt) {
      const base = autoSlugBase(cur.title, cur.slug);
      if (base) {
        for (let n = 1; n <= 10; n++) {
          try {
            await repo.changeSlug(postId, withSuffix(base, n));
            break;
          } catch (e) {
            if (!(e instanceof SlugTakenError) || n === 10) throw e;
          }
        }
      }
    }
    const dateChanged =
      date.date !== undefined && (!cur.publishedAt || toZonedInput(cur.publishedAt, tz) !== dateIn);
    const orgChange = await resolveOrg(cur, opts.defaultCategory ?? false);
    const patch = {
      ...orgChange,
      ...(vis !== cur.visibility ? { visibility: vis } : {}),
      ...(feat !== (cur.featured === true) ? { featured: feat } : {}),
      ...(commentsOn !== (cur.commentsEnabled !== false) ? { commentsEnabled: commentsOn } : {}),
      ...(coverIn !== (cur.coverMediaId ?? null) ? { coverMediaId: coverIn } : {}),
      ...(sameCrop(coverIn ? cropIn : null, cur.coverCrop) ? {} : { coverCrop: coverIn ? cropIn : null }),
      ...(sameIds(galleryIn, cur.gallery ?? []) ? {} : { gallery: galleryIn.length ? galleryIn : null }),
      ...(placeIn.trim() !== (cur.location ?? "") ? { location: placeIn.trim() || null } : {}),
      ...(dateChanged ? { publishedAt: date.date } : {}),
      ...extra,
    };
    if (Object.keys(patch).length) await repo.update(postId, patch);
  }

  /**
   * সংগঠনের বদল-patch: নতুন ট্যাগ আগে তৈরি (idempotent id); প্রকাশে ক্যাটাগরি না থাকলে ডিফল্ট।
   * বিকল্প লোড না হলে (opts≠ready) সংগঠন ছোঁয়া হয় না — পুরনো মান অক্ষত।
   */
  async function resolveOrg(cur: PostWithId, defaultCategory: boolean) {
    if (!org || !orgOpts || orgOpts === "error") return {};
    const order = parseSeriesOrder(orderIn);
    if (org.seriesId && order === "invalid") throw new Error("order");
    let next: OrgState = { ...org, seriesOrder: org.seriesId && order !== "invalid" ? order : null };
    if (defaultCategory && !next.categoryId) {
      const d = await (await getTaxonomyOps()).ensureDefaultCategory();
      next = { ...next, categoryId: d.id, categoryName: d.name };
    }
    const patch = orgPatch(orgFromPost(cur), next);
    if (patch.tagIds) {
      const tagRepo = await getTaxonomyRepo("tags");
      for (const tg of next.tags) {
        if (pendingTags.includes(tg.id)) await tagRepo.create({ id: tg.id, name: tg.name });
      }
    }
    return patch;
  }

  /** affectsSite = পাবলিক সাইটে প্রভাব পড়ে এমন ক্রিয়া → সফল হলে rebuild trigger (Arch §১২; autosave-এ কখনো না) */
  async function run(action: (repo: PostRepo) => Promise<string>, affectsSite = false, liveNote = true) {
    if (!engine || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await flushLocal();
      await engine.syncNow(); // সর্বশেষ লেখা আগে রিমোটে — ব্যর্থ হলে এখানেই থামে
      if (engine.status === "conflict" || engine.status === "trashed") {
        setMsg({ kind: "err", text: bn.publishPanel.conflictFirst });
        return;
      }
      let text = await engine.exclusive(async (repo) => {
        const t = await action(repo);
        await refresh(repo);
        return t;
      });
      // নতুন-প্রকাশে লিংক সঙ্গে সঙ্গে খোলে (`/api/live`) ⇒ "১–২ মিনিট" নোট নয়; rebuild পেছনে চলে (তালিকা/sitemap/RSS)
      if (affectsSite) {
        const ok = await triggerSiteRebuild();
        if (!ok) text += ` ${bn.build.triggerFailed}`;
        else if (liveNote) text += ` ${bn.build.liveIn}`;
      }
      setMsg({ kind: "ok", text });
    } catch (e) {
      const reason = e instanceof Error ? e.message : "";
      setMsg({
        kind: "err",
        text:
          e instanceof SlugTakenError
            ? bn.publishPanel.slugTaken
            : reason === "order"
                ? bn.org.panel.orderInvalid
                : reason === "past"
                ? bn.publishPanel.schedulePast
                : reason === "empty"
                ? bn.publishPanel.scheduleEmpty
                : reason === "invalid"
                ? bn.publishPanel.dateInvalid
                : reason === "future"
                  ? bn.publishPanel.dateFuture
                  : bn.publishPanel.failed,
      });
    } finally {
      setBusy(false);
    }
  }

  const wordCount = async (fallback: number) => (await draftStore.loadDraft(postId))?.wordCount ?? fallback;

  const onPublish = () =>
    run(async (repo) => {
      await writeMeta(repo, { status: "published", ...(meta?.post.status === "scheduled" ? { scheduledAt: null } : {}) }, { defaultCategory: true, autoSlug: true });
      await snapshotOnPublish(postId).catch(() => undefined); // ইতিহাস best-effort — প্রকাশ আটকায় না
      return bn.publishPanel.publishedOk;
    }, true, false);
  /** P11c-১: সময় নির্ধারণ — status=scheduled + scheduledAt (UTC); সময় হলে Cron publish করে। সাইটে এখনই প্রভাব নেই ⇒ rebuild নয় */
  const onSchedule = () =>
    run(async (repo) => {
      const s = parseScheduleInput(dateIn, nowMs(), tz);
      if (!s.ok) throw new Error(s.reason);
      await writeMeta(repo, { status: "scheduled", scheduledAt: s.date }, { defaultCategory: true, autoSlug: true });
      await snapshotOnPublish(postId).catch(() => undefined);
      return bn.publishPanel.scheduledOk;
    });
  const onUnschedule = () =>
    run(async (repo) => {
      await writeMeta(repo, { status: "draft", scheduledAt: null });
      return bn.publishPanel.savedOk;
    });
  const onUpdate = () =>
    run(async (repo) => {
      await writeMeta(repo);
      await repo.applyDraft(postId, await wordCount(meta?.post.wordCount ?? 0));
      await snapshotOnPublish(postId).catch(() => undefined);
      return bn.publishPanel.updatedOk;
    }, true);
  const onDone = () =>
    run(async (repo) => {
      await writeMeta(repo);
      return bn.publishPanel.savedOk;
    }, meta?.post.status === "published"); // slug/visibility/তারিখ-বদল প্রকাশিত লেখায় সাইটে প্রভাব ফেলে
  const onRevert = () => {
    if (!confirm(bn.publishPanel.confirmRevert)) return;
    return run(async (repo) => {
      // থাকা অপ্রকাশিত সম্পাদনা আগে posts-এ কপি, তারপর Draft (Arch §১২-গ) — কিছু হারায় না
      await repo.applyDraft(postId, await wordCount(meta?.post.wordCount ?? 0));
      await repo.update(postId, { status: "draft" });
      return bn.publishPanel.savedOk;
    }, true);
  };
  const onDiscard = async () => {
    if (!engine || busy || !confirm(bn.publishPanel.confirmDiscard)) return;
    setBusy(true);
    try {
      await engine.exclusive((repo) => repo.discardDraft(postId));
      await p.onDiscarded(); // লোকাল ড্রাফট মুছে রিলোড — রিমোটের প্রকাশিত লেখা ফেরে
    } catch {
      setMsg({ kind: "err", text: bn.publishPanel.failed });
      setBusy(false);
    }
  };

  const published = meta?.post.status === "published";
  /** প্রকাশিত+public লেখার পাবলিক লিংক (নতুন লেখায় সঙ্গে সঙ্গে খোলে) */
  const liveHref = published && meta?.post.visibility === "public" && meta.post.slug ? blogPath(meta.post.slug) : null;
  const scheduled = meta?.post.status === "scheduled";
  return (
    <div className={p.docked ? "fixed inset-y-0 right-0 z-40 w-96" : "fixed inset-0 z-40"} role="presentation">
      {!p.docked && <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />}
      <div
        role="dialog"
        aria-modal={p.docked ? undefined : "true"}
        aria-label={bn.publishPanel.title}
        className={`${p.docked ? "absolute inset-0 overflow-y-auto border-l border-line bg-surface p-5" : "absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-96 md:rounded-none md:rounded-l-3xl"}`}
      >
        <div className="mb-4 flex items-center">
          <h2 className="flex-1 font-serif text-xl font-bold">{bn.publishPanel.title}</h2>
          <button type="button" onClick={onClose} aria-label={bn.publishPanel.close} className="size-11 text-xl">
            ✕
          </button>
        </div>

        {state === "loading" && (
          <p role="status" className="text-muted">
            {bn.publishPanel.loading}
          </p>
        )}
        {state === "empty" && <p className="text-muted">{bn.publishPanel.nothingYet}</p>}
        {state === "error" && (
          <p role="alert" className="text-muted">
            {status === "conflict" ? bn.publishPanel.conflictFirst : bn.publishPanel.loadFailed}{" "}
            <button type="button" onClick={retry} className="min-h-11 text-accent-text underline">
              {bn.publishPanel.retry}
            </button>
          </p>
        )}

        {state === "ready" && meta && (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="text-muted">{bn.publishPanel.state}: </span>
              <span className="rounded-full bg-line px-2 py-0.5">
                {published ? bn.publishPanel.published : scheduled ? bn.publishPanel.scheduled : bn.publishPanel.draft}
              </span>
              {scheduled && meta.post.scheduledAt && (
                <span className="ml-2 text-muted">{bn.publishPanel.scheduledFor(formatLongDateTime(meta.post.scheduledAt, tz))}</span>
              )}
              {published && meta.hasDraft && (
                <span className="ml-2 text-accent-text">{bn.publishPanel.unpublished}</span>
              )}
            </p>

            <div>
              <div className="mb-1.5 text-sm text-muted">{bn.publishPanel.visibility}</div>
              <Segmented<PostVisibility>
                label={bn.publishPanel.visibility}
                value={vis}
                options={[
                  { value: "private", label: bn.publishPanel.private },
                  { value: "public", label: bn.publishPanel.public },
                  { value: "unlisted", label: bn.publishPanel.unlisted },
                ]}
                onChange={setVis}
              />
              {vis === "unlisted" && <p className="mt-1 text-xs text-muted">{bn.publishPanel.unlistedHint}</p>}
            </div>

            {org && (
              <OrgSection
                value={org}
                onChange={setOrg}
                opts={orgOpts}
                pending={pendingTags}
                onPending={setPendingTags}
                orderInput={orderIn}
                onOrderInput={setOrderIn}
                published={published}
                disabled={busy}
                onRetry={() => {
                  setOrgOpts(null);
                  setOptsTick((n) => n + 1);
                }}
              />
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="flex min-w-0 flex-col justify-between rounded-xl border border-line bg-bg px-3 py-1.5 focus-within:border-accent">
                <label htmlFor="pp-date" className="block text-xs text-muted">
                  {bn.publishPanel.publishedAt}
                </label>
                <input
                  id="pp-date"
                  type="datetime-local"
                  value={dateIn}
                  max={published ? maxIn || undefined : undefined}
                  disabled={busy}
                  onChange={(e) => setDateIn(e.target.value)}
                  className="field-clean min-h-9 w-full min-w-0 bg-transparent text-sm"
                />
              </div>
              <button
                type="button"
                aria-expanded={coverOpen}
                onClick={() => setCoverOpen((o) => !o)}
                className="flex min-h-14 min-w-0 items-center justify-between gap-2 rounded-xl border border-line bg-bg px-3 py-1.5 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-xs text-muted">{bn.publishPanel.sections.cover}</span>
                  <span className="block truncate text-base">{coverIn ? bn.publishPanel.sections.coverSet : bn.publishPanel.sections.coverPick}</span>
                </span>
                <span aria-hidden="true" className={`shrink-0 text-muted transition-transform ${coverOpen ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>
            </div>
            <p className="-mt-1 text-xs text-muted">{published ? bn.publishPanel.publishedAtHint : bn.publishPanel.dateHintNew}</p>

            {coverOpen && (
              <div className="space-y-3 rounded-2xl border border-line p-4">
                <CoverPicker value={coverIn} onChange={setCoverIn} disabled={busy} crop={cropIn} />
                {coverIn && (
                  <div className="space-y-2">
                    <Segmented<CoverRatio | "full">
                      label={bn.publishPanel.coverCrop.ratioLabel}
                      showLabel
                      compact
                      value={cropIn?.ratio ?? "full"}
                      options={[{ value: "full", label: bn.publishPanel.coverCrop.full }, ...COVER_RATIOS.map((v) => ({ value: v, label: bn.publishPanel.coverCrop.ratios[v] }))]}
                      onChange={(v) => setCropIn(v === "full" ? null : { ratio: v, focus: cropIn?.focus ?? "center" })}
                    />
                    {cropIn && (
                      <Segmented<CoverFocus>
                        label={bn.publishPanel.coverCrop.focusLabel}
                        showLabel
                        compact
                        value={cropIn.focus}
                        options={COVER_FOCUS.map((v) => ({ value: v, label: bn.publishPanel.coverCrop.focus[v] }))}
                        onChange={(v) => setCropIn({ ...cropIn, focus: v })}
                      />
                    )}
                    <p className="text-xs text-muted">{bn.publishPanel.coverCrop.hint}</p>
                  </div>
                )}
              </div>
            )}

            {(meta.post.contentType === "diary" || meta.post.contentType === "travel" || placeIn.trim() !== "") && (
              <Section title={bn.publishPanel.place.label} hint={placeIn.trim() || undefined}>
                <label className="block">
                  <span className="sr-only">{bn.publishPanel.place.label}</span>
                  <input
                    type="text"
                    value={placeIn}
                    maxLength={MAX_LOCATION}
                    disabled={busy}
                    placeholder={bn.publishPanel.place.placeholder}
                    onChange={(e) => setPlaceIn(e.target.value)}
                    className={input}
                  />
                  <span className="mt-1 block text-xs text-muted">{bn.publishPanel.place.hint}</span>
                </label>
              </Section>
            )}

            {(meta.post.contentType === "diary" || meta.post.contentType === "travel" || galleryIn.length > 0) && (
              <Section title={bn.publishPanel.sections.gallery} hint={bn.publishPanel.sections.galleryHint(galleryIn.length)}>
                <GalleryPicker value={galleryIn} onChange={setGalleryIn} disabled={busy} />
              </Section>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label title={bn.publishPanel.featuredHint} className={`flex min-h-12 min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${feat ? "border-accent bg-line" : "border-line"}`}>
                <input type="checkbox" checked={feat} onChange={(e) => setFeat(e.target.checked)} className="size-5 shrink-0" />
                {bn.publishPanel.featured}
              </label>
              <label title={bn.publishPanel.commentsOnHint} className={`flex min-h-12 min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${commentsOn ? "border-accent bg-line" : "border-line"}`}>
                <input type="checkbox" checked={commentsOn} onChange={(e) => setCommentsOn(e.target.checked)} className="size-5 shrink-0" />
                {bn.publishPanel.sections.commentsShort}
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a href={`/dashboard/shares?post=${postId}`} className="inline-flex min-h-11 items-center text-accent-text underline">
                🔗 {bn.shareLink.openPanel}
              </a>
              {scheduled && (
                <button type="button" onClick={onUnschedule} disabled={busy} className={btnGhost}>
                  {bn.publishPanel.scheduleCancel}
                </button>
              )}
              {published && meta.hasDraft && (
                <button type="button" onClick={onDiscard} disabled={busy} className={btnGhost}>
                  {bn.publishPanel.discard}
                </button>
              )}
              {published && (
                <button type="button" onClick={onRevert} disabled={busy} className={btnGhost}>
                  {bn.publishPanel.revert}
                </button>
              )}
            </div>

            {/* প্রধান ক্রিয়া সবসময় নাগালে: নিচে আটকানো বার */}
            <div className="sticky bottom-0 z-10 -mx-5 space-y-2 border-t border-line bg-surface px-5 py-3">
              {msg && (
                <p role={msg.kind === "err" ? "alert" : "status"} className={msg.kind === "err" ? "text-accent-text" : "text-muted"}>
                  {msg.text}
                  {msg.kind === "ok" && liveHref && (
                    <>
                      {" "}
                      <a href={liveHref} target="_blank" rel="noopener" className="text-accent-text underline">
                        {bn.publishPanel.openPost}
                      </a>
                    </>
                  )}
                </p>
              )}
              <div className="flex gap-2">
                {published ? (
                  <button type="button" onClick={onUpdate} disabled={busy || !meta.hasDraft} className={`${btnPrimary} flex-1`}>
                    {busy ? bn.publishPanel.working : bn.publishPanel.update}
                  </button>
                ) : dateIn !== "" && dateIn > maxIn ? (
                  <button type="button" onClick={onSchedule} disabled={busy} className={`${btnPrimary} flex-1`}>
                    {busy ? bn.publishPanel.working : bn.publishPanel.scheduleBtn}
                  </button>
                ) : (
                  <button type="button" onClick={onPublish} disabled={busy} className={`${btnPrimary} flex-1`}>
                    {busy ? bn.publishPanel.working : bn.publishPanel.publish}
                  </button>
                )}
                <button type="button" onClick={onDone} disabled={busy} className={btnGhost}>
                  {bn.publishPanel.done}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** ভাঁজযোগ্য কার্ড: শিরোনাম + বর্তমান মানের সংক্ষিপ্ত ইঙ্গিত; বন্ধ থাকলেও ভেতরের state/সেভ অক্ষত (<details> ভেতরের ইনপুট মুছে না) */
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-line">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 [&::-webkit-details-marker]:hidden">
        <span className="font-semibold">{title}</span>
        <span className="flex min-w-0 items-center gap-2 text-sm text-muted">
          {hint && <span className="truncate">{hint}</span>}
          <span aria-hidden="true" className="transition-transform group-open:rotate-180">
            ▾
          </span>
        </span>
      </summary>
      <div className="space-y-4 border-t border-line px-4 py-4 [&>fieldset:first-child]:border-t-0 [&>fieldset:first-child]:pt-0">{children}</div>
    </details>
  );
}
