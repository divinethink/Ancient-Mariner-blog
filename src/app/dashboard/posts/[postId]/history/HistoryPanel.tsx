"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { restoreChapterRevision, snapshotChapterCurrent } from "@/data/chapterRevisionActions";
import { draftStore } from "@/data/draftStore";
import { localStore } from "@/data/localStore";
import { getPostRepo } from "@/data/postRepo.wire";
import { getProjectRepo } from "@/data/projectRepo.wire";
import { bodyWords, restoreRevision, snapshotCurrent } from "@/data/revisionActions";
import type { RevisionWithId } from "@/data/revisionRepo";
import { getRevisionRepo } from "@/data/revisionRepo.wire";
import { syncAllDirty } from "@/data/syncEngine";
import { bn } from "@/i18n/bn";
import { formatDateTime } from "@/lib/datetime";
import { ConfirmButton } from "../../../ConfirmButton";
import { useSiteTimezone } from "../../../SiteSettingsProvider";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "missing" }
  | { kind: "ready"; title: string; items: RevisionWithId[]; blocked: boolean };

/** অধ্যায়ের অসংরক্ষিত লোকাল কপির key (ChapterEditor-এর সাথে একই) */
const chapterLocalKey = (id: string) => `chapterdraft:${id}`;
const ghost = "min-h-11 rounded-full border border-line px-4 disabled:opacity-50";

/** `chapterOf` (প্রজেক্ট-id) থাকলে `postId` আসলে অধ্যায়ের id — একই কম্পোনেন্ট, ডেটা-পথ আলাদা (P14a-৩) */
export function HistoryPanel({ postId, chapterOf }: { postId: string; chapterOf?: string }) {
  const editHref = chapterOf ? `/dashboard/projects/${chapterOf}/chapters/${postId}` : `/dashboard/posts/${postId}/edit`;
  const h = bn.history;
  const tz = useSiteTimezone();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async (): Promise<State> => {
    try {
      if (chapterOf) {
        const [projects, revs] = await Promise.all([getProjectRepo(), getRevisionRepo()]);
        const [ch, items, local] = await Promise.all([
          projects.getChapter(postId),
          revs.list(postId, { targetType: "chapter" }),
          localStore.get(chapterLocalKey(postId)).catch(() => undefined),
        ]);
        if (!ch || ch.projectId !== chapterOf || ch.status === "trashed") return { kind: "missing" };
        return { kind: "ready", title: ch.title, items, blocked: !!local }; // লোকাল কপি = সংরক্ষণহীন লেখা; Restore তা মুছে দিত
      }
      const [posts, revs] = await Promise.all([getPostRepo(), getRevisionRepo()]);
      // Restore-এর আগে এই ডিভাইসের সংরক্ষণহীন লেখা sync (নইলে Restore সেটা মুছে দিত)
      await syncAllDirty(posts, draftStore).catch(() => 0);
      const [post, items, local] = await Promise.all([
        posts.get(postId),
        revs.list(postId),
        draftStore.loadDraft(postId).catch(() => undefined),
      ]);
      if (!post || post.status === "trashed") return { kind: "missing" };
      return { kind: "ready", title: post.title, items, blocked: !!local?.dirty };
    } catch {
      return { kind: "error" };
    }
  }, [postId, chapterOf]);

  useEffect(() => {
    let dead = false;
    load().then((s) => {
      if (!dead) setState(s);
    });
    return () => {
      dead = true;
    };
  }, [load, attempt]);

  const refresh = async () => setState(await load());

  async function saveNow() {
    setBusy(true);
    setMsg(null);
    try {
      const revs = await getRevisionRepo();
      const made = chapterOf
        ? await snapshotChapterCurrent(await getProjectRepo(), revs, postId, "manual")
        : await snapshotCurrent(await getPostRepo(), revs, postId, "manual");
      setMsg({ ok: true, text: made ? h.saved : h.unchanged });
      await refresh();
    } catch {
      setMsg({ ok: false, text: h.failed });
    } finally {
      setBusy(false);
    }
  }

  async function restore(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      const revs = await getRevisionRepo();
      const res = chapterOf
        ? await restoreChapterRevision(await getProjectRepo(), revs, id)
        : await restoreRevision(await getPostRepo(), revs, id);
      if (res.kind === "restored") {
        // লোকাল কপি বাদ — editor খুলে রিমোটের (restore-করা) লেখা পাবে; sync-base editor-ই বসায়
        if (chapterOf) await localStore.delete(chapterLocalKey(postId)).catch(() => undefined);
        else await draftStore.deleteDraft(postId).catch(() => undefined);
        setMsg({ ok: true, text: res.published ? h.restoredPublished : h.restoredDraft });
        await refresh();
      } else {
        setMsg({ ok: res.kind === "same", text: res.kind === "same" ? h.same : h.unavailable });
      }
    } catch {
      setMsg({ ok: false, text: h.failed });
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Link href={editHref} className="mb-3 inline-flex min-h-11 items-center text-accent-text">
      {h.back}
    </Link>
  );

  if (state.kind === "loading") {
    return (
      <>
        {back}
        <p role="status" aria-live="polite" className="text-muted">
          {h.loading}
        </p>
      </>
    );
  }
  if (state.kind === "error" || state.kind === "missing") {
    return (
      <>
        {back}
        <p role="alert" className="text-muted">
          {state.kind === "missing" ? h.notFound : h.loadFailed}{" "}
          {state.kind === "error" && (
            <button
              type="button"
              className="min-h-11 text-accent-text underline"
              onClick={() => {
                setState({ kind: "loading" });
                setAttempt((a) => a + 1);
              }}
            >
              {h.retry}
            </button>
          )}
        </p>
      </>
    );
  }

  return (
    <>
      {back}
      <h1 className="mb-2 font-serif text-3xl font-bold">
        {h.title} — {state.title || bn.library.untitled}
      </h1>
      <p className="mb-4 text-muted">{h.intro}</p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} onClick={() => void saveNow()} className={ghost}>
          {h.saveNow}
        </button>
      </div>
      {state.blocked && (
        <p role="alert" className="mb-4 rounded-xl border border-line bg-surface p-3 text-sm">
          {chapterOf ? h.unsyncedChapter : h.unsynced}
        </p>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} aria-live="polite" className={`mb-4 text-sm ${msg.ok ? "" : "text-accent-text"}`}>
          {msg.text}{" "}
          {msg.ok && msg.text !== h.saved && msg.text !== h.unchanged && msg.text !== h.same && (
            <Link href={editHref} className="text-accent-text underline">
              {h.openEditor}
            </Link>
          )}
        </p>
      )}
      {state.items.length === 0 ? (
        <p className="text-muted">{h.empty}</p>
      ) : (
        <ul className="space-y-3">
          {state.items.map((r) => (
            <li key={r.id} className="rounded-2xl border border-line bg-surface p-4">
              <p className="font-semibold">
                {h.version} {r.versionNumber} · {formatDateTime(r.createdAt, tz)}
              </p>
              <p className="mb-3 text-sm text-muted">
                {h.trigger[r.trigger]} · {bodyWords(r.snapshot)} {h.words}
              </p>
              <ConfirmButton
                label={h.restore}
                question={h.confirmRestore}
                onConfirm={() => void restore(r.id)}
                disabled={busy || state.blocked}
                className={ghost}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
