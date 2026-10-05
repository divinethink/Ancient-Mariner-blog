"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { draftStore } from "@/data/draftStore";
import type { PostWithId } from "@/data/postRepo";
import { getPostRepo } from "@/data/postRepo.wire";
import { syncAllDirty } from "@/data/syncEngine";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { trashDaysLeft } from "@/lib/trash";
import { TrashList, type TrashItem } from "./TrashList";

type Item = {
  id: string;
  title: string;
  status: "draft" | "published";
  localOnly: boolean; // Firestore-এ এখনো নেই
  wordCount: number;
  updatedAt: number;
};
type Filter = "all" | "draft" | "published" | "trash";
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
    map.set(p.id, {
      id: p.id,
      title: p.title,
      status: p.status === "published" ? "published" : "draft",
      localOnly: false,
      wordCount: p.wordCount,
      updatedAt: p.updatedAt.getTime(),
    });
  }
  for (const d of locals) {
    if (trashedIds.has(d.id)) continue; // ট্র্যাশের লেখা লোকাল-only হয়ে ফিরে আসে না
    const r = map.get(d.id);
    if (r && r.updatedAt >= d.updatedAt) continue; // রিমোট নতুন/সমান — তা-ই দেখাই
    map.set(d.id, {
      id: d.id,
      title: d.title,
      status: r?.status ?? "draft",
      localOnly: !r,
      wordCount: d.wordCount,
      updatedAt: d.updatedAt,
    });
  }
  const items = [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  return { items, trashed, remoteFailed: remote === null };
}

function PostMenu({ onTrash, disabled }: { onTrash: () => void; disabled: boolean }) {
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
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen(false);
            onTrash();
          }}
          className="absolute right-0 top-11 z-10 min-h-11 whitespace-nowrap rounded-xl border border-line bg-surface px-4 shadow disabled:opacity-50"
        >
          {bn.library.trashIt}
        </button>
      )}
    </div>
  );
}

export function LibraryHome() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const bgSynced = useRef(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
      await repo.trash(id);
      await draftStore.deleteDraft(id);
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
  const shown = items.filter((it) => filter === "all" || it.status === filter);
  const chips: [Filter, string][] = [
    ["all", bn.library.filterAll],
    ["draft", bn.library.draft],
    ["published", bn.library.published],
    ["trash", `${bn.library.filterTrash}${trashed.length ? ` (${trashed.length})` : ""}`],
  ];
  return (
    <>
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
        </p>
      )}
      {latest && filter !== "trash" && (
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
      <div role="group" aria-label={bn.library.filters} className="mb-4 flex flex-wrap gap-2">
        {chips.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`min-h-11 rounded-full border px-4 text-sm ${
              filter === key ? "border-transparent bg-btn-bg text-btn-tx" : "border-line"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {filter === "trash" ? (
        <TrashList
          items={trashed}
          busy={busy}
          onRestore={restorePost}
          onDelete={deletePost}
          onEmpty={emptyAll}
        />
      ) : items.length === 0 ? (
        <p className="text-muted">{bn.library.empty}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((it) => (
            <li key={it.id} className="flex items-start gap-1">
              <Link
                href={`/dashboard/posts/${it.id}/edit`}
                className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl border border-line bg-surface p-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-lg font-bold">
                    {it.title || bn.library.untitled}
                  </span>
                  <span className="text-sm text-muted">
                    {formatDate(new Date(it.updatedAt))} · {it.wordCount} {bn.library.words}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-xs text-muted">
                  {it.localOnly
                    ? bn.library.localOnly
                    : it.status === "published"
                      ? bn.library.published
                      : bn.library.draft}
                </span>
              </Link>
              <PostMenu disabled={busy} onTrash={() => void trashPost(it.id)} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
