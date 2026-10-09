"use client";

import Link from "next/link";
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
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { CONTENT_TYPE, type ContentType, type PostStatus } from "@/lib/enums";
import { FIND_LIMIT } from "@/lib/postFind";
import { buildCategoryTree } from "@/lib/taxonomy";
import { trashDaysLeft } from "@/lib/trash";
import { BulkBar } from "./BulkBar";
import { HomeCards } from "./HomeCards";
import { useSiteTimezone } from "./SiteSettingsProvider";
import { useLongPress } from "./useLongPress";
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
type Found = { key: string; items: Item[] | null }; // items=null ⇒ ব্যর্থ
type Filter = "all" | "draft" | "published" | "archived" | "trash";
type Loaded = { items: Item[]; trashed: TrashItem[]; remoteFailed: boolean };
type State = { kind: "loading" } | ({ kind: "ready" } & Loaded);

async function loadItems(): Promise<Loaded> {
  const [locals, remote] = await Promise.all([
    draftStore.listDrafts().catch(() => []),
    getPostRepo()
      .then(async (r) => ({ posts: await r.list(), trashedPosts: await r.listTrashed() }))
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

function PostMenu({ id, onTrash, disabled }: { id: string; onTrash: () => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
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
          <Link
            href={`/dashboard/posts/${id}/history`}
            className="flex min-h-11 items-center whitespace-nowrap px-4"
          >
            {bn.library.history}
          </Link>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              onTrash();
            }}
            className="min-h-11 whitespace-nowrap px-4 text-left disabled:opacity-50"
          >
            {bn.library.trashIt}
          </button>
        </div>
      )}
    </div>
  );
}

export function LibraryHome() {
  const tz = useSiteTimezone();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const bgSynced = useRef(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Bulk select-mode (P3b-ক)
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [progress, setProgress] = useState<{ d: number; t: number } | null>(null);
  const [lastReq, setLastReq] = useState<BulkRequest | null>(null);
  // 🔍 খোঁজ ও Type/Category ফিল্টার (P3a-২খ): শর্ত থাকলে সার্ভার-query-র ফল দেখায় (প্রথম ~৫০টা), নইলে স্বাভাবিক তালিকা
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState(""); // debounce-করা (read সাশ্রয়)
  const [typeF, setTypeF] = useState<ContentType | "">("");
  const [catF, setCatF] = useState("");
  const [cats, setCats] = useState<TermWithId[]>([]);
  const [found, setFound] = useState<Found | null>(null);
  const [findTick, setFindTick] = useState(0);
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
        r.find({ titlePrefix: dq, contentType: typeF || undefined, categoryId: catF || undefined, limit: FIND_LIMIT }),
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
      if (bgSynced.current || r.remoteFailed || !(await draftStore.hasUnsynced().catch(() => false))) return;
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

  function retry() {
    setState({ kind: "loading" });
    setAttempt((a) => a + 1);
  }

  /** একটা ক্রিয়া চালায়; double-tap-এ দ্বিতীয়টা বাদ (busy), শেষে তালিকা নতুন করে পড়ে */
  async function act(fn: (repo: Awaited<ReturnType<typeof getPostRepo>>) => Promise<string | void>) {
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
      const wasPublished = state.kind === "ready" && state.items.find((i) => i.id === id)?.status === "published";
      await repo.trash(id);
      await draftStore.deleteDraft(id);
      // প্রকাশিত লেখা ট্র্যাশে গেলে পাবলিক সাইট থেকে সরাতে rebuild (Arch §১২)
      if (wasPublished) return (await triggerSiteRebuild()) ? bn.build.liveIn : bn.build.triggerFailed;
    });
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
      if (sum.affectsPublic > 0) msg += ` · ${(await triggerSiteRebuild()) ? bn.build.liveIn : bn.build.triggerFailed}`;
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
  const selectableIds = filter === "trash" ? trashed.map((t) => t.id) : shown.filter((i) => !i.localOnly).map((i) => i.id);
  const selStatuses = [...selected].map((id) => known.get(id)).filter((x): x is PostStatus => !!x);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const rowBody = (it: Item) => (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-lg font-bold">{it.title || bn.library.untitled}</span>
        <span className="text-sm text-muted">
          {formatDate(new Date(it.updatedAt), tz)} · {it.wordCount} {bn.library.words}
          {it.contentType && it.contentType !== "post" && ` · ${bn.org.types[it.contentType] ?? it.contentType}`}
          {it.categoryName && ` · ${it.categoryName}`}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-xs text-muted">
        {it.localOnly
          ? bn.library.localOnly
          : it.rawStatus === "published"
            ? bn.library.published
            : it.rawStatus === "archived"
              ? bn.library.archived
              : bn.library.draft}
      </span>
    </>
  );
  const chips: [Filter, string][] = [
    ["all", bn.library.filterAll],
    ["draft", bn.library.draft],
    ["published", bn.library.published],
    ["archived", bn.library.filterArchived],
    ["trash", `${bn.library.filterTrash}${trashed.length ? ` (${trashed.length})` : ""}`],
  ];
  return (
    <div className={selecting ? "pb-64" : undefined}>
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
              <button type="button" onClick={() => void runBulkReq(lastReq)} className="min-h-11 text-accent-text underline">
                {bn.bulk.retry(selected.size)}
              </button>
            </>
          )}
        </p>
      )}
      {latest && filter !== "trash" && !selecting && (
        <Link
          href={`/dashboard/posts/${latest.id}/edit`}
          className="mb-5 block rounded-2xl bg-btn-bg p-4 text-btn-tx"
        >
          <span className="text-sm opacity-90">▶ {bn.library.resume}</span>
          <span className="block font-serif text-lg font-bold">
            {latest.title || bn.library.untitled}
          </span>
        </Link>
      )}
      {filter !== "trash" && !selecting && (
        <HomeCards
          published={items.filter((i) => i.rawStatus === "published").length}
          drafts={items.filter((i) => i.rawStatus === "draft").length}
        />
      )}
      <div role="group" aria-label={bn.library.filters} className="mb-4 flex flex-wrap gap-2">
        {chips.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => {
              setFilter(key);
              setSelected(new Set()); // অন্য দৃশ্যের লেখা নির্বাচনে থাকে না
              setLastReq(null);
            }}
            className={`min-h-11 rounded-full border px-4 text-sm ${
              filter === key ? "border-transparent bg-btn-bg text-btn-tx" : "border-line"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mb-4">
        <button
          type="button"
          aria-pressed={selecting}
          disabled={busy}
          onClick={() => (selecting ? exitSelect() : setSelecting(true))}
          className="min-h-11 rounded-full border border-line px-4 text-sm"
        >
          {selecting ? bn.bulk.toggleOff : bn.bulk.toggle}
        </button>
      </div>
      {filter !== "trash" && (
        <div className="mb-4">
          <button
            type="button"
            aria-pressed={searchOpen}
            onClick={() => setSearchOpen((o) => !o)}
            className="min-h-11 rounded-full border border-line px-4 text-sm"
          >
            🔍 {searchOpen ? bn.org.find.close : bn.org.find.open}
          </button>
          {searchOpen && (
            <div className="mt-3 space-y-3 rounded-2xl border border-line bg-surface p-4">
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
          <button type="button" onClick={() => setFindTick((n) => n + 1)} className="min-h-11 underline">
            {bn.library.retry}
          </button>
        </p>
      )}
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
      {filter !== "trash" && (searching ? shown.length > 0 : items.length > 0) && (
        <ul className="space-y-3">
          {shown.map((it) => (
            <li key={it.id} className="flex items-start gap-1">
              {selecting ? (
                <label
                  className={`flex min-w-0 flex-1 items-start gap-3 rounded-2xl border bg-surface p-4 ${
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
                  <Link
                    href={`/dashboard/posts/${it.id}/edit`}
                    {...(it.localOnly ? {} : longPress(it.id))}
                    className="flex min-w-0 flex-1 select-none items-start gap-3 rounded-2xl border border-line bg-surface p-4 [-webkit-touch-callout:none]"
                  >
                    {rowBody(it)}
                  </Link>
                  <PostMenu id={it.id} disabled={busy} onTrash={() => void trashPost(it.id)} />
                </>
              )}
              {selecting && it.localOnly && <span className="sr-only">{bn.bulk.localOnlyNote}</span>}
            </li>
          ))}
        </ul>
      )}
      {searching && base.length >= FIND_LIMIT && <p className="mt-3 text-sm text-muted">{bn.org.find.limited(FIND_LIMIT)}</p>}
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
