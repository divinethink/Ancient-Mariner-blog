"use client";

// owner-এর বুকমার্ক ও হাইলাইট (P12-৩): প্রিভিউ-পেজে ☆ বোতাম + `.reading`-এর ভেতরে লেখা নির্বাচন করলে [হাইলাইট সংরক্ষণ] পপ-আপ।
// সব ডেটা-কাজ bookmarkRepo দিয়ে; হাইলাইট-id আগে বানানো ⇒ double-tap/retry-তে duplicate নয়। শুধু plain text উদ্ধৃতি (offset নয়)।
import { useEffect, useRef, useState } from "react";
import { getBookmarkRepo } from "@/data/bookmarkRepo.wire";
import { bn } from "@/i18n/bn";
import { newId } from "@/lib/id";
import { cleanQuote, quotePopupPos } from "@/lib/reader";

const t = bn.marks;
type Pop = { text: string; top: number; left: number };
const HIDE_DELAY = 300;

export function ReadingMarks({ postId, title }: { postId: string; title: string }) {
  const [marked, setMarked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [pop, setPop] = useState<Pop | null>(null);
  const [msg, setMsg] = useState("");
  const pending = useRef<{ text: string; id: string } | null>(null); // একই নির্বাচনের retry-তে একই id
  const timers = useRef<{ read?: number; hide?: number; msg?: number }>({});

  useEffect(() => {
    let dead = false;
    getBookmarkRepo()
      .then((r) => r.isBookmarked(postId))
      .then((v) => !dead && setMarked(v))
      .catch(() => !dead && setMarked(false));
    return () => {
      dead = true;
    };
  }, [postId]);

  useEffect(() => {
    const tm = timers.current;
    const read = () => {
      const sel = window.getSelection();
      const root = document.querySelector(".reading");
      const anc = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).commonAncestorContainer : null;
      const text = sel && !sel.isCollapsed && root && anc && root.contains(anc.nodeType === 1 ? anc : anc.parentNode) ? cleanQuote(sel.toString()) : null;
      if (!text || !sel) {
        window.clearTimeout(tm.hide);
        tm.hide = window.setTimeout(() => setPop(null), HIDE_DELAY);
        return;
      }
      window.clearTimeout(tm.hide);
      const r = sel.getRangeAt(0).getBoundingClientRect();
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      setPop({ text, ...quotePopupPos(r, window.innerWidth, window.innerHeight, coarse, 200) });
    };
    const onChange = () => {
      window.clearTimeout(tm.read);
      tm.read = window.setTimeout(read, 120);
    };
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("scroll", onChange, { passive: true });
    window.addEventListener("resize", onChange, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
      window.clearTimeout(tm.read);
      window.clearTimeout(tm.hide);
      window.clearTimeout(tm.msg);
    };
  }, []);

  const toggle = async () => {
    if (marked === null || busy) return;
    setBusy(true);
    try {
      const repo = await getBookmarkRepo();
      if (marked) await repo.removeBookmark(postId);
      else await repo.addBookmark(postId, title);
      setMarked(!marked);
    } catch {
      setMsg(t.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  const flash = (m: string) => {
    setMsg(m);
    window.clearTimeout(timers.current.msg);
    timers.current.msg = window.setTimeout(() => setMsg(""), 2000);
  };
  const saveHighlight = async () => {
    if (!pop || busy) return;
    if (pending.current?.text !== pop.text) pending.current = { text: pop.text, id: newId() };
    setBusy(true);
    try {
      await (await getBookmarkRepo()).addHighlight({ id: pending.current.id, postId, postTitle: title, quote: pop.text });
      pending.current = null;
      flash(t.saved);
    } catch {
      flash(t.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={marked === null || busy}
          aria-pressed={marked === true}
          className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm disabled:opacity-50"
        >
          {marked ? t.bookmarked : t.bookmark}
        </button>
        {msg && !pop && (
          <span role="status" aria-live="polite" className="text-sm text-muted">
            {msg}
          </span>
        )}
      </div>
      {pop && (
        <div
          role="toolbar"
          aria-label={t.highlightBar}
          onMouseDown={(e) => e.preventDefault()}
          className="fixed z-50 flex w-[200px] items-center overflow-hidden rounded-full border border-line bg-surface shadow-lg select-none"
          style={{ top: pop.top, left: pop.left }}
        >
          {msg ? (
            <span role="status" aria-live="polite" className="inline-flex min-h-11 flex-1 items-center justify-center px-3 text-sm text-muted">
              {msg}
            </span>
          ) : (
            <button type="button" onClick={saveHighlight} disabled={busy} className="inline-flex min-h-11 flex-1 items-center justify-center px-3 text-sm disabled:opacity-50">
              {t.highlightSave}
            </button>
          )}
        </div>
      )}
    </>
  );
}
