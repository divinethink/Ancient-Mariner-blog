"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { draftStore } from "@/data/draftStore";
import { getPostRepo } from "@/data/postRepo.wire";
import { syncAllDirty } from "@/data/syncEngine";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";

type Item = {
  id: string;
  title: string;
  status: "draft" | "published";
  localOnly: boolean; // Firestore-এ এখনো নেই
  wordCount: number;
  updatedAt: number;
};
type State =
  | { kind: "loading" }
  | { kind: "ready"; items: Item[]; remoteFailed: boolean };

async function loadItems(): Promise<{ items: Item[]; remoteFailed: boolean }> {
  const [locals, remote] = await Promise.all([
    draftStore.listDrafts().catch(() => []),
    getPostRepo()
      .then((r) => r.list())
      .then((posts) => ({ posts }))
      .catch(() => null),
  ]);
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
  return { items, remoteFailed: remote === null };
}

export function LibraryHome() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const bgSynced = useRef(false);

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

  const { items, remoteFailed } = state;
  const latest = items[0];
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
      {latest && (
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
      {items.length === 0 ? (
        <p className="text-muted">{bn.library.empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={`/dashboard/posts/${it.id}/edit`}
                className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4"
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
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
