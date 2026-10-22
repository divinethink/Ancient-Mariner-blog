"use client";

// বুকমার্ক ও হাইলাইট-তালিকা (P12-৩): নতুন আগে (সীমা MARKS_PAGE); সরানো দুই-ধাপ confirm-এ; সব কাজ bookmarkRepo দিয়ে।
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Bookmark, HighlightWithId } from "@/data/bookmarkRepo";
import { getBookmarkRepo } from "@/data/bookmarkRepo.wire";
import { EmptyState } from "@/components/ui/EmptyState";
import { bn } from "@/i18n/bn";
import { ConfirmButton } from "../ConfirmButton";

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; bookmarks: Array<Bookmark & { id: string }>; highlights: HighlightWithId[] };
const t = bn.marks;
const ghost = "min-h-11 rounded-full border border-line px-4 text-sm disabled:opacity-50";

export function BookmarksView() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const repo = await getBookmarkRepo();
        const [bookmarks, highlights] = await Promise.all([repo.listBookmarks(), repo.listHighlights()]);
        if (!dead) setLoad({ kind: "ready", bookmarks, highlights });
      } catch {
        if (!dead) setLoad({ kind: "error" });
      }
    })();
    return () => {
      dead = true;
    };
  }, [tick]);

  const run = async (fn: (r: Awaited<ReturnType<typeof getBookmarkRepo>>) => Promise<void>) => {
    setBusy(true);
    try {
      await fn(await getBookmarkRepo());
      setTick((n) => n + 1);
    } catch {
      setLoad({ kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (load.kind === "loading") return <p role="status" aria-live="polite" className="text-muted">{t.loading}</p>;
  if (load.kind === "error") {
    return (
      <p role="alert" className="text-muted">
        {t.loadFailed}{" "}
        <button type="button" className="min-h-11 text-accent-text underline" onClick={() => { setLoad({ kind: "loading" }); setTick((n) => n + 1); }}>
          {t.retry}
        </button>
      </p>
    );
  }

  const link = (postId: string, title: string) => (
    <Link href={`/dashboard/posts/${postId}/preview`} className="text-accent-text">
      {title || bn.library.untitled}
    </Link>
  );
  return (
    <div className="space-y-8">
      <section aria-labelledby="bm-h">
        <h2 id="bm-h" className="mb-2 font-serif text-xl font-semibold">{t.bookmarksTitle}</h2>
        {load.bookmarks.length === 0 ? (
          <EmptyState icon="bookmark" text={t.emptyBookmarks} />
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {load.bookmarks.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span className="min-w-0 flex-1">{link(b.postId, b.postTitle)}</span>
                <ConfirmButton label={t.remove} question={t.removeAsk} disabled={busy} className={ghost} onConfirm={() => run((r) => r.removeBookmark(b.postId))} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="hl-h">
        <h2 id="hl-h" className="mb-2 font-serif text-xl font-semibold">{t.highlightsTitle}</h2>
        {load.highlights.length === 0 ? (
          <EmptyState icon="bookmark" text={t.emptyHighlights} />
        ) : (
          <ul className="space-y-3">
            {load.highlights.map((h) => (
              <li key={h.id} className="rounded-2xl border border-line bg-surface p-3">
                <blockquote className="border-l-2 border-accent pl-3 font-serif">{h.quote}</blockquote>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1">— {link(h.postId, h.postTitle)}</span>
                  <ConfirmButton label={t.remove} question={t.removeAsk} disabled={busy} className={ghost} onConfirm={() => run((r) => r.deleteHighlight(h.id))} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
