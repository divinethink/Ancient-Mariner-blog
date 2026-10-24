"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { runBulkAction } from "@/data/bulk.wire";
import type { BulkRequest, BulkSpec, BulkSummary } from "@/data/bulkRun";
import { draftStore } from "@/data/draftStore";
import { getTaxonomyRepo } from "@/data/taxonomyRepo.wire";
import type { TermWithId } from "@/data/taxonomyRepo";
import type { PostWithId } from "@/data/postRepo";
import { triggerSiteRebuild } from "@/data/rebuildClient";
import { getPostRepo } from "@/data/postRepo.wire";
import { syncAllDirty } from "@/data/syncEngine";
import { Icon } from "@/components/icons";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { CONTENT_TYPE, type ContentType, type PostStatus } from "@/lib/enums";
import { FIND_LIMIT } from "@/lib/postFind";
import { buildCategoryTree } from "@/lib/taxonomy";
import { trashDaysLeft } from "@/lib/trash";
import { BulkBar } from "./BulkBar";
import { HomeCards, HomeTopRow } from "./HomeCards";
import { useSiteTimezone } from "./SiteSettingsProvider";
import { setPaletteTitles } from "./paletteSource";
import { useLongPress } from "./useLongPress";
import { useHomeCards } from "./useHomeCards";
import { useMinWidth } from "./useMinWidth";
import { TrashList, type TrashItem } from "./TrashList";

type Item = {
  id: string;
  title: string;
  status: "draft" | "published";
  rawStatus: PostStatus; // archived আলাদা দেখাতে/ফিল্টারে
  localOnly: boolean; // Firestore-এ এখনো নেই
  wordCount: number;
  updatedAt: number;
  contentType?: string;
  categoryName?: string;
};
const toItem = (p: PostWithId): Item => ({
  id: p.id,
  title: p.title,
  status: p.status === "published" ? "published" : "draft",
  rawStatus: p.status,
  localOnly: false,
  wordCount: p.wordCount,
  updatedAt: p.updatedAt.getTime(),
  contentType: p.contentType,
  categoryName: p.categoryName,
});
const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
type View = "list" | "split" | "table";
const VIEWS: View[] = ["list", "split", "table"];
const statusLabel = (it: Item) =>
  it.localOnly
    ? bn.library.localOnly
    : it.rawStatus === "published"
      ? bn.library.published
      : it.rawStatus === "archived"
        ? bn.library.archived
        : bn.library.draft;
type Found = { key: string; items: Item[] | null }; // items=null ⇒ ব্যর্থ
type Filter = "all" | "draft" | "published" | "archived" | "trash";
const FILTER_ORDER: readonly Filter[] = ["draft", "published", "archived", "all", "trash"];
// লাইব্রেরি সবসময় "Draft" ফিল্টারে খোলে (শেষ বাছা মনে রাখা হয় না)
const DEFAULT_FILTER: Filter = "draft";
type Loaded = { items: Item[]; trashed: TrashItem[]; remoteFailed: boolean };
type State = { kind: "loading" } | ({ kind: "ready" } & Loaded);

async function loadItems(): Promise<Loaded> {
  const [locals, remote] = await Promise.all([
    draftStore.listDrafts().catch(() => []),
    getPostRepo()
      .then(async (r) => ({ posts: await r.list({ all: true }), trashedPosts: await r.listTrashed() }))
      .catch(() => null),
  ]);
  const now = Date.now();
  const trashedAt = (p: PostWithId) => (p.trashedAt ?? p.updatedAt).getTime();
  const trashed: TrashItem[] = [...(remote?.trashedPosts ?? [])]
    .sort((a, b) => trashedAt(b) - trashedAt(a))
    .map((p) => ({
      id: p.id,
      title: p.title,
      wordCount: p.wordCount,
      daysLeft: trashDaysLeft(p.trashedAt ?? p.updatedAt, now),
    }));
  const trashedIds = new Set(trashed.map((t) => t.id));
  const map = new Map<string, Item>();
  for (const p of remote?.posts ?? []) {
    if (p.status === "trashed") continue;
    map.set(p.id, toItem(p));
  }
  for (const d of locals) {
    if (trashedIds.has(d.id)) continue; // ট্র্যাশের লেখা লোকাল-only হয়ে ফিরে আসে না
    const r = map.get(d.id);
    if (r && r.updatedAt >= d.updatedAt) continue; // রিমোট নতুন/সমান — তা-ই দেখাই
    map.set(d.id, {
      id: d.id,
      title: d.title,
      status: r?.status ?? "draft",
      rawStatus: r?.rawStatus ?? "draft",
      localOnly: !r,
      wordCount: d.wordCount,
      updatedAt: d.updatedAt,
      contentType: r?.contentType,
      categoryName: r?.categoryName,
    });
  }
  const items = [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  return { items, trashed, remoteFailed: remote === null };
}

function PostMenu({
  id,
  rawStatus,
  onTrash,
  onStatus,
  disabled,
  className = "relative shrink-0",
}: {
  id: string;
  rawStatus: PostStatus;
  onTrash: () => void;
  onStatus: (kind: "unpublish" | "archive") => void;
  disabled: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const row = "min-h-11 whitespace-nowrap px-4 text-left disabled:opacity-50";
  return (
    <div className={className}>
      <button
        type="button"
        aria-label={bn.library.menuOpen}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="min-h-11 min-w-11 rounded-full text-xl"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-10 flex flex-col rounded-xl border border-line bg-surface shadow">
          <Link href={`/dashboard/posts/${id}/edit`} className="flex min-h-11 items-center whitespace-nowrap px-4">
            {bn.library.editIt}
          </Link>
          <Link
            href={`/dashboard/posts/${id}/history`}
            className="flex min-h-11 items-center whitespace-nowrap px-4"
          >
            {bn.library.history}
          </Link>
          {rawStatus !== "draft" && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                onStatus("unpublish");
              }}
              className={row}
            >
              {bn.editor.status.draft}
            </button>
          )}
          {rawStatus !== "archived" && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                onStatus("archive");
              }}
              className={row}
            >
              {bn.editor.status.archive}
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              onTrash();
            }}
            className={row}
          >
            {bn.library.trashIt}
          </button>
        </div>
      )}
    </div>
  );
}

/** হেডার (ধাপ ২): শিরোনাম + `৬ প্রকাশিত · ১৬ খসড়া` উপশিরোনাম + আইকন-বাটন (খোঁজ · নির্বাচন · ⋯) */
function LibraryHeader({
  counts,
  selecting,
  selectDisabled,
  onToggleSelect,
}: {
  counts: { published: number; drafts: number } | null;
  selecting: boolean;
  selectDisabled: boolean;
  onToggleSelect: () => void;
}) {
  const hc = useHomeCards();
  const iconBtn = "flex size-11 shrink-0 items-center justify-center rounded-full border border-line";
  return (
    <div className="mb-4 flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <h1 className="font-serif text-3xl font-bold">{bn.dashboard.library}</h1>
        {counts && (!hc || hc.glance) && (
          <p className="text-sm text-muted">{bn.home.glance(counts.published, counts.drafts)}</p>
        )}
      </div>
      <Link href="/dashboard/search" aria-label={bn.search.navLabel} className={iconBtn}>
        <Icon name="search" size={20} />
      </Link>
      <button
        type="button"
        aria-label={selecting ? bn.bulk.toggleOff : bn.bulk.toggle}
        aria-pressed={selecting}
        disabled={selectDisabled}
        onClick={onToggleSelect}
        className={`${iconBtn} disabled:opacity-50 ${selecting ? "border-transparent bg-btn-bg text-btn-tx" : ""}`}
      >
        <Icon name="check" size={20} />
      </button>
    </div>
  );
}

export function LibraryHome() {
  const tz = useSiteTimezone();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const bgSynced = useRef(false);
  const [filter, setFilter] = useState<Filter>(DEFAULT_FILTER);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Bulk select-mode (P3b-ক)
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [progress, setProgress] = useState<{ d: number; t: number } | null>(null);
  const [lastReq, setLastReq] = useState<BulkRequest | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  function pickFilter(k: Filter) {
    setFilter(k);
    setSelected(new Set()); // অন্য দৃশ্যের লেখা নির্বাচনে থাকে না
    setLastReq(null);
  }
  // তালিকায় বাঁ/ডানে সোয়াইপ ⇒ পাশের ফিল্টার (চিপ-সারি/নির্বাচন-মোডে নয়)
  const swipeStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = t && !selecting && !(e.target as HTMLElement).closest("[data-noswipe],input,select,textarea") ? { x: t.clientX, y: t.clientY } : null;
  };
  const swipeEnd = (e: React.TouchEvent) => {
    const s0 = touch.current;
    const t = e.changedTouches[0];
    touch.current = null;
    if (!s0 || !t) return;
    const dx = t.clientX - s0.x;
    if (Math.abs(dx) < 80 || Math.abs(t.clientY - s0.y) > 40) return;
    const next = FILTER_ORDER[FILTER_ORDER.indexOf(filter) + (dx < 0 ? 1 : -1)];
    if (next) pickFilter(next);
  };
  // 🔍 খোঁজ ও Type/Category ফিল্টার (P3a-২খ): শর্ত থাকলে সার্ভার-query-র ফল দেখায় (প্রথম ~৫০টা), নইলে স্বাভাবিক তালিকা
  const [searchOpen] = useState(false); // মেনু থেকে "খুঁজুন" সরানো হয়েছে (বাম পাশে সার্চ-আইকন আছে); panel সুপ্ত
  const [q, setQ] = useState("");
  const [dq, setDq] = useState(""); // debounce-করা (read সাশ্রয়)
  const [typeF, setTypeF] = useState<ContentType | "">("");
  const [catF, setCatF] = useState("");
  const [cats, setCats] = useState<TermWithId[]>([]);
  const [found, setFound] = useState<Found | null>(null);
  const [findTick, setFindTick] = useState(0);
  // Desktop (≥1024px) দৃশ্য: তালিকা | পাশাপাশি | টেবিল — মোবাইলে সবসময় তালিকা
  const desktop = useMinWidth(1024);
  const [view, setView] = useState<View>("list");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const mode: View = desktop ? view : "list";
  const active = dq.trim() !== "" || typeF !== "" || catF !== "";
  const findKey = JSON.stringify([dq.trim(), typeF, catF, findTick]);

  useEffect(() => {
    const id = setTimeout(() => setDq(q), 400);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    if (!searchOpen) return;
    let dead = false;
    getTaxonomyRepo("categories")
      .then((r) => r.list())
      .then((c) => {
        if (!dead) setCats(c);
      })
      .catch(() => undefined); // ফিল্টার ছাড়া শুধু খোঁজ চলে
    return () => {
      dead = true;
    };
  }, [searchOpen]);

  useEffect(() => {
    if (!active) return;
    let dead = false;
    getPostRepo()
      .then((r) =>
        r.find({
          titlePrefix: dq,
          contentType: typeF || undefined,
          categoryId: catF || undefined,
          limit: FIND_LIMIT,
        }),
      )
      .then((ps) => {
        if (!dead) setFound({ key: findKey, items: ps.map(toItem) });
      })
      .catch(() => {
        if (!dead) setFound({ key: findKey, items: null });
      });
    return () => {
      dead = true;
    };
  }, [active, dq, typeF, catF, findKey]);

  useEffect(() => {
    let dead = false;
    loadItems().then(async (r) => {
      if (dead) return;
      setState({ kind: "ready", ...r });
      // editor ছেড়ে আসার পর বাকি থাকা সংরক্ষণহীন ড্রাফট নীরবে Firestore-এ (প্রতি মাউন্টে একবার)
      if (
        bgSynced.current ||
        r.remoteFailed ||
        !(await draftStore.hasUnsynced().catch(() => false))
      )
        return;
      bgSynced.current = true;
      const repo = await getPostRepo().catch(() => null);
      if (repo && (await syncAllDirty(repo, draftStore)) > 0 && !dead) {
        const fresh = await loadItems();
        if (!dead) setState({ kind: "ready", ...fresh });
      }
    });
    return () => {
      dead = true;
    };
  }, [attempt]);

  // Command palette-কে লোড-হওয়া শিরোনাম দেয় (শুধু memory; অতিরিক্ত read নেই)
  useEffect(() => {
    if (state.kind === "ready")
      setPaletteTitles(state.items.map((i) => ({ id: i.id, title: i.title })));
  }, [state]);

  function retry() {
    setState({ kind: "loading" });
    setAttempt((a) => a + 1);
  }

  /** একটা ক্রিয়া চালায়; double-tap-এ দ্বিতীয়টা বাদ (busy), শেষে তালিকা নতুন করে পড়ে */
  async function act(
    fn: (repo: Awaited<ReturnType<typeof getPostRepo>>) => Promise<string | void>,
  ) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const msg = await fn(await getPostRepo());
      if (msg) setNotice(msg);
    } catch {
      setNotice(bn.trash.actionFailed);
    }
    const fresh = await loadItems();
    setState({ kind: "ready", ...fresh });
    setBusy(false);
  }

  const trashPost = (id: string) =>
    act(async (repo) => {
      // সংরক্ষণহীন লোকাল লেখা আগে সার্ভারে — নইলে ট্র্যাশের সাথে লোকাল মোছায় হারাত
      await syncAllDirty(repo, draftStore);
      if ((await draftStore.loadDraft(id))?.dirty) return bn.library.trashUnsynced;
      // সার্ভারে নেই (সিঙ্ক-করা কপি আর নেই) কিন্তু লোকালে ক্লিন কপি আছে ⇒ repo.trash ব্যর্থ হতো; লোকাল কপি সরালেই তালিকা থেকে যায়
      if (!(await repo.get(id))) {
        await draftStore.deleteDraft(id);
        return;
      }
      const wasPublished =
        state.kind === "ready" && state.items.find((i) => i.id === id)?.status === "published";
      await repo.trash(id);
      await draftStore.deleteDraft(id);
      // প্রকাশিত লেখা ট্র্যাশে গেলে পাবলিক সাইট থেকে সরাতে rebuild (Arch §১২)
      if (wasPublished)
        return (await triggerSiteRebuild()) ? bn.build.liveIn : bn.build.triggerFailed;
    });
  /** ⋯ মেনু থেকে খসড়া/আর্কাইভ — bulk-এর নিরাপদ পথ (অসংরক্ষিত লোকাল সম্পাদনা থাকলে বাদ); প্রকাশিত লেখায় confirm + rebuild */
  const statusPost = (id: string, kind: "unpublish" | "archive") => {
    const it = [...(state.kind === "ready" ? state.items : []), ...(found?.items ?? [])].find((i) => i.id === id);
    if (it?.rawStatus === "published" && !confirm(kind === "archive" ? bn.editor.status.confirmArchive : bn.editor.status.confirmDraft)) return;
    void runBulkReq({ kind, ids: [id] });
  };
  const restorePost = (id: string) => act((repo) => repo.restore(id));
  const deletePost = (id: string) =>
    act(async (repo) => {
      await repo.deletePermanently(id);
      await draftStore.deleteDraft(id);
    });
  const emptyAll = () =>
    act(async (repo) => {
      const ids = (state.kind === "ready" ? state.trashed : []).map((t) => t.id);
      const r = await repo.emptyTrash();
      await Promise.all(ids.map((id) => draftStore.deleteDraft(id).catch(() => undefined)));
      return r.failed > 0 ? bn.trash.emptyPartial : undefined;
    });

  const toggleSel = (id: string) =>
    setSelected((cur) => {
      const n = new Set(cur);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const startSelect = (id: string) => {
    setSelecting(true);
    setSelected(new Set([id]));
  };
  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const longPress = useLongPress(startSelect);

  /** Bulk ক্রিয়া চালায়: double-tap-এ দ্বিতীয়টা বাদ (busy); শেষে সারাংশ, দরকারে একটাই rebuild, তালিকা নতুন করে পড়া */
  async function runBulkReq(req: BulkRequest) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    setProgress(null);
    try {
      const sum: BulkSummary = await runBulkAction(req, (d, t) => setProgress({ d, t }));
      const parts = [bn.bulk.done(sum.updated)];
      if (sum.unchanged) parts.push(bn.bulk.unchanged(sum.unchanged));
      if (sum.notApplicable) parts.push(bn.bulk.notApplicable(sum.notApplicable));
      if (sum.unsynced) parts.push(bn.bulk.unsynced(sum.unsynced));
      if (sum.missing) parts.push(bn.bulk.missing(sum.missing));
      if (sum.failedIds.length) parts.push(bn.bulk.failed(sum.failedIds.length));
      let msg = parts.join(" · ");
      if (sum.affectsPublic > 0)
        msg += ` · ${(await triggerSiteRebuild()) ? bn.build.liveIn : bn.build.triggerFailed}`;
      setNotice(msg);
      setLastReq(sum.failedIds.length > 0 ? req : null); // retry = একই request (idempotent)
      setSelected(new Set(sum.failedIds));
      if (sum.failedIds.length === 0) setSelecting(false);
    } catch {
      setNotice(bn.trash.actionFailed);
    }
    setProgress(null);
    setFindTick((n) => n + 1); // খোঁজ-ফল চালু থাকলে নতুন করে
    const fresh = await loadItems();
    setState({ kind: "ready", ...fresh });
    setBusy(false);
  }
  const runSpec = (spec: BulkSpec) => void runBulkReq({ ...spec, ids: [...selected] });

  if (state.kind === "loading") {
    return (
      <div role="status" aria-live="polite">
        <div className="mb-4">
          <h1 className="font-serif text-3xl font-bold">{bn.dashboard.library}</h1>
        </div>
        <p className="sr-only">{bn.library.loading}</p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="mb-3 h-20 animate-pulse rounded-2xl bg-line" />
        ))}
      </div>
    );
  }

  const { items, trashed, remoteFailed } = state;
  const latest = items[0];
  const searching = active && filter !== "trash";
  const findLoading = searching && found?.key !== findKey;
  const findFailed = searching && found?.key === findKey && found.items === null;
  const base = searching ? (found?.key === findKey ? (found.items ?? []) : []) : items;
  const shown = base.filter((it) => filter === "all" || it.rawStatus === filter);
  // select-mode: নির্বাচিত id-গুলোর অবস্থা (প্রযোজ্যতার সংখ্যা) ও 'সব' = এই দৃশ্যের নির্বাচনযোগ্য সবাই
  const known = new Map<string, PostStatus>([
    ...items.map((i) => [i.id, i.rawStatus] as const),
    ...(found?.items ?? []).map((i) => [i.id, i.rawStatus] as const),
    ...trashed.map((t) => [t.id, "trashed" as PostStatus] as const),
  ]);
  const selectableIds =
    filter === "trash"
      ? trashed.map((t) => t.id)
      : shown.filter((i) => !i.localOnly).map((i) => i.id);
  const selStatuses = [...selected].map((id) => known.get(id)).filter((x): x is PostStatus => !!x);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const rowBody = (it: Item) => (
    <span className="min-w-0 flex-1">
      <span
        className="block select-text truncate font-serif text-lg font-bold [-webkit-touch-callout:default]"
        onPointerDown={(e) => e.stopPropagation()} // শিরোনামে চেপে ধরলে লেখা সিলেক্ট (নির্বাচন-মোড নয়)
      >
        {it.title || bn.library.untitled}
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-xs">{statusLabel(it)}</span>
        <span className="whitespace-nowrap">{formatDate(new Date(it.updatedAt), tz)}</span>
        <span aria-hidden>·</span>
        <span className="whitespace-nowrap">
          {bnNum(it.wordCount)} {bn.library.words}
        </span>
        {it.contentType && it.contentType !== "post" && (
          <>
            <span aria-hidden>·</span>
            <span>{bn.org.types[it.contentType] ?? it.contentType}</span>
          </>
        )}
        {it.categoryName && (
          <>
            <span aria-hidden>·</span>
            <span>{it.categoryName}</span>
          </>
        )}
      </span>
    </span>
  );
  const countOf = (k: Filter) =>
    k === "all" ? items.length : k === "trash" ? trashed.length : items.filter((i) => i.rawStatus === k).length;
  // ক্রম: খসড়া, প্রকাশিত, আর্কাইভ, সব, ট্র্যাশ (শেষে)
  const chips: [Filter, string][] = [
    ["draft", bn.library.draft],
    ["published", bn.library.published],
    ["archived", bn.library.filterArchived],
    ["all", bn.library.filterAll],
    ["trash", bn.library.filterTrash],
  ];
  const showList = filter !== "trash" && (searching ? shown.length > 0 : items.length > 0);
  const previewItem = shown.find((i) => i.id === previewId) ?? null;
  const listUl = (
    <ul className="space-y-3">
      {shown.map((it) => (
        <li key={it.id} className="relative">
          {selecting ? (
            <label
              className={`flex min-w-0 items-start gap-3 rounded-2xl border bg-surface p-4 ${
                selected.has(it.id) ? "border-accent" : "border-line"
              } ${it.localOnly ? "opacity-60" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                aria-label={bn.bulk.pick(it.title || bn.library.untitled)}
                checked={selected.has(it.id)}
                disabled={it.localOnly || busy}
                onChange={() => toggleSel(it.id)}
                className="mt-1 size-6 shrink-0 accent-[var(--accent)]"
              />
              {rowBody(it)}
            </label>
          ) : (
            <>
              {/* <a> নয়, div: লিংকে long-press করলে ব্রাউজার লেখা সিলেক্ট করতে দেয় না — শিরোনাম আঙুলে মার্ক করে কপির জন্য */}
              <div
                role="link"
                tabIndex={0}
                {...(it.localOnly ? {} : longPress(it.id))}
                onClick={(e) => {
                  if (!it.localOnly) longPress(it.id).onClick(e); // long-press-এর পরের click বাদ
                  if (e.defaultPrevented || window.getSelection()?.toString()) return; // সিলেক্ট করা থাকলে খুলবে না
                  router.push(`/dashboard/posts/${it.id}/edit`);
                }}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/dashboard/posts/${it.id}/edit`)}
                className="flex min-w-0 cursor-pointer select-none items-start gap-3 rounded-2xl border border-line bg-surface p-4 pr-12 [-webkit-touch-callout:none]"
              >
                {rowBody(it)}
              </div>
              <PostMenu
                id={it.id}
                rawStatus={it.rawStatus}
                onStatus={(k) => statusPost(it.id, k)}
                disabled={busy}
                onTrash={() => void trashPost(it.id)}
                className="absolute right-1 top-1"
              />
            </>
          )}
          {selecting && it.localOnly && <span className="sr-only">{bn.bulk.localOnlyNote}</span>}
        </li>
      ))}
    </ul>
  );
  return (
    <div
      onTouchStart={swipeStart}
      onTouchEnd={swipeEnd}
      className={`${selecting ? "pb-64" : ""} ${mode === "list" || filter === "trash" ? "mx-auto max-w-3xl" : ""}`}
    >
      <LibraryHeader
        counts={{
          published: items.filter((i) => i.rawStatus === "published").length,
          drafts: items.filter((i) => i.rawStatus === "draft").length,
        }}
        selecting={selecting}
        selectDisabled={busy}
        onToggleSelect={() => (selecting ? exitSelect() : setSelecting(true))}
      />
      {remoteFailed && (
        <p role="alert" className="mb-4 rounded-xl border border-line bg-surface p-3 text-muted">
          {bn.library.loadFailed}{" "}
          <button type="button" onClick={retry} className="min-h-11 text-accent-text underline">
            {bn.library.retry}
          </button>
        </p>
      )}
      {notice && (
        <p role="alert" className="mb-4 rounded-xl border border-line bg-surface p-3 text-muted">
          {notice}
          {lastReq && !busy && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => void runBulkReq(lastReq)}
                className="min-h-11 text-accent-text underline"
              >
                {bn.bulk.retry(selected.size)}
              </button>
            </>
          )}
        </p>
      )}
      {filter !== "trash" && !selecting && (
        <HomeTopRow latest={latest ? { id: latest.id, title: latest.title } : null} />
      )}
      {filter !== "trash" && !selecting && <HomeCards />}
      <div
        role="group"
        aria-label={bn.library.filters}
        data-noswipe
        className="-mx-6 mb-4 flex snap-x scroll-px-6 gap-1.5 overflow-x-auto overscroll-x-contain px-6 pb-1 [mask-image:linear-gradient(to_right,#000_calc(100%_-_1.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {chips.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => pickFilter(key)}
            className={`min-h-11 shrink-0 snap-start whitespace-nowrap rounded-full border px-4 text-sm ${
              filter === key ? "border-transparent bg-btn-bg text-btn-tx" : "border-line"
            }`}
          >
            {label} {countOf(key)}
          </button>
        ))}
      </div>
      {desktop && filter !== "trash" && (
        <div role="group" aria-label={bn.library.view.label} className="mb-4 flex gap-2">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`min-h-11 rounded-full border px-4 text-sm ${
                view === v ? "border-transparent bg-btn-bg text-btn-tx" : "border-line"
              }`}
            >
              {bn.library.view[v]}
            </button>
          ))}
        </div>
      )}
      {filter !== "trash" && (
        <div className="mb-4">
          {searchOpen && (
            <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
              <label className="block text-sm text-muted">
                {bn.org.find.label}
                <input
                  type="search"
                  value={q}
                  lang="bn"
                  placeholder={bn.org.find.placeholder}
                  onChange={(e) => setQ(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-base text-text"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label={bn.org.find.typeLabel}
                  value={typeF}
                  onChange={(e) => setTypeF(e.target.value as ContentType | "")}
                  className="min-h-11 rounded-full border border-line bg-bg px-3 text-sm"
                >
                  <option value="">{bn.org.find.allTypes}</option>
                  {CONTENT_TYPE.map((c) => (
                    <option key={c} value={c}>
                      {bn.org.types[c] ?? c}
                    </option>
                  ))}
                </select>
                {cats.length > 0 && (
                  <select
                    aria-label={bn.org.find.categoryLabel}
                    value={catF}
                    onChange={(e) => setCatF(e.target.value)}
                    className="min-h-11 rounded-full border border-line bg-bg px-3 text-sm"
                  >
                    <option value="">{bn.org.find.allCategories}</option>
                    {buildCategoryTree(cats).map(({ term, depth }) => (
                      <option key={term.id} value={term.id}>
                        {depth ? "— " : ""}
                        {term.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-xs text-muted">{bn.org.find.prefixNote}</p>
            </div>
          )}
        </div>
      )}
      {findLoading && (
        <p role="status" className="mb-3 text-muted">
          {bn.org.find.loading}
        </p>
      )}
      {findFailed && (
        <p role="alert" className="mb-3 text-accent-text">
          {bn.org.find.failed}{" "}
          <button
            type="button"
            onClick={() => setFindTick((n) => n + 1)}
            className="min-h-11 underline"
          >
            {bn.library.retry}
          </button>
        </p>
      )}
      {filter === "trash" && <h2 className="mb-2 font-semibold">{bn.library.trashTitle}</h2>}
      {filter === "trash" ? (
        <TrashList
          items={trashed}
          busy={busy}
          onRestore={restorePost}
          onDelete={deletePost}
          onEmpty={emptyAll}
          selecting={selecting}
          selected={selected}
          onToggle={toggleSel}
        />
      ) : searching ? (
        findLoading || findFailed ? null : shown.length === 0 ? (
          <p className="text-muted">{bn.org.find.none}</p>
        ) : null
      ) : items.length === 0 ? (
        <p className="text-muted">{bn.library.empty}</p>
      ) : null}
      {showList && mode === "table" && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-muted">
              <tr className="border-b border-line">
                {selecting && (
                  <th scope="col" className="w-12 p-3">
                    <span className="sr-only">{bn.library.col.select}</span>
                  </th>
                )}
                {(["title", "type", "category", "status", "date", "words"] as const).map((c) => (
                  <th key={c} scope="col" className="p-3 font-semibold">
                    {bn.library.col[c]}
                  </th>
                ))}
                {!selecting && (
                  <th scope="col" className="w-12 p-3">
                    <span className="sr-only">{bn.library.menuOpen}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {shown.map((it) => (
                <tr
                  key={it.id}
                  className={`border-b border-line last:border-b-0 ${selected.has(it.id) ? "bg-line" : ""}`}
                >
                  {selecting && (
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={bn.bulk.pick(it.title || bn.library.untitled)}
                        checked={selected.has(it.id)}
                        disabled={it.localOnly || busy}
                        onChange={() => toggleSel(it.id)}
                        className="size-6 accent-[var(--accent)]"
                      />
                    </td>
                  )}
                  <td className="max-w-[22rem] p-3">
                    {selecting ? (
                      <span className="block truncate font-serif text-base font-bold">
                        {it.title || bn.library.untitled}
                      </span>
                    ) : (
                      <Link
                        href={`/dashboard/posts/${it.id}/edit`}
                        className="block min-h-11 truncate py-2.5 font-serif text-base font-bold"
                      >
                        {it.title || bn.library.untitled}
                      </Link>
                    )}
                  </td>
                  <td className="p-3 text-muted">
                    {bn.org.types[it.contentType ?? "post"] ?? it.contentType ?? "—"}
                  </td>
                  <td className="p-3 text-muted">{it.categoryName ?? "—"}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-line px-2 py-0.5 text-xs text-muted">
                      {statusLabel(it)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap p-3 text-muted">
                    {formatDate(new Date(it.updatedAt), tz)}
                  </td>
                  <td className="p-3 text-muted">{bnNum(it.wordCount)}</td>
                  {!selecting && (
                    <td className="p-1">
                      <PostMenu id={it.id} rawStatus={it.rawStatus} onStatus={(k) => statusPost(it.id, k)} disabled={busy} onTrash={() => void trashPost(it.id)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showList && mode === "split" && (
        <div className="grid grid-cols-[360px_minmax(0,1fr)] items-start gap-6">
          {selecting ? (
            listUl
          ) : (
            <ul className="space-y-3">
              {shown.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    aria-pressed={previewItem?.id === it.id}
                    onClick={() => setPreviewId(it.id)}
                    className={`flex w-full items-start gap-3 rounded-2xl border bg-surface p-4 text-left ${
                      previewItem?.id === it.id ? "border-accent" : "border-line"
                    }`}
                  >
                    {rowBody(it)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <aside
            aria-live="polite"
            className="sticky top-6 rounded-2xl border border-line bg-surface p-6"
          >
            {previewItem ? (
              <div className="space-y-3">
                <h2 className="font-serif text-2xl font-bold">
                  {previewItem.title || bn.library.untitled}
                </h2>
                <p className="text-sm text-muted">
                  {statusLabel(previewItem)} · {formatDate(new Date(previewItem.updatedAt), tz)} ·{" "}
                  {previewItem.wordCount} {bn.library.words}
                  {previewItem.contentType &&
                    previewItem.contentType !== "post" &&
                    ` · ${bn.org.types[previewItem.contentType] ?? previewItem.contentType}`}
                  {previewItem.categoryName && ` · ${previewItem.categoryName}`}
                </p>
                {previewItem.localOnly && (
                  <p className="text-sm text-muted">{bn.library.split.localOnly}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/posts/${previewItem.id}/edit`}
                    className="flex min-h-11 items-center rounded-full bg-btn-bg px-5 text-sm text-btn-tx"
                  >
                    {bn.library.split.edit}
                  </Link>
                  {!previewItem.localOnly && (
                    <Link
                      href={`/dashboard/posts/${previewItem.id}/history`}
                      className="flex min-h-11 items-center rounded-full border border-line px-5 text-sm"
                    >
                      {bn.library.history}
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted">{bn.library.split.pick}</p>
            )}
          </aside>
        </div>
      )}
      {showList && mode === "list" && listUl}
      {searching && base.length >= FIND_LIMIT && (
        <p className="mt-3 text-sm text-muted">{bn.org.find.limited(FIND_LIMIT)}</p>
      )}
      {selecting && (
        <BulkBar
          statuses={selStatuses}
          allSelected={allSelected}
          trashView={filter === "trash"}
          busy={busy}
          progress={progress}
          onToggleAll={() => setSelected(allSelected ? new Set() : new Set(selectableIds))}
          onExit={exitSelect}
          onRun={runSpec}
        />
      )}
    </div>
  );
}
