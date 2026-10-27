"use client";

import { useEffect, useRef, useState } from "react";
import type { BookWithId } from "@/data/bookRepo";
import { getBookRepo } from "@/data/bookRepo.wire";
import { triggerSiteRebuild } from "@/data/rebuildClient";
import { bn } from "@/i18n/bn";
import { BOOK_AUTHOR_MAX, BOOK_NOTE_MAX, BOOK_TITLE_MAX, countByStatus, finishedInYear, sortFinished } from "@/lib/books";
import { dayKey } from "@/lib/datetime";
import type { BookStatus, BookVisibility } from "@/lib/enums";
import { newId } from "@/lib/id";
import { EmptyState } from "@/components/ui/EmptyState";
import { AddToggle } from "@/components/ui/AddToggle";
import { ClampText } from "@/components/ui/ClampText";
import { StatusCards, type StatusCardOption } from "@/components/ui/StatusCards";
import { ConfirmButton } from "../ConfirmButton";
import { CoverPicker } from "../posts/[postId]/edit/CoverPicker";
import { useSiteTimezone } from "../SiteSettingsProvider";

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
const field = "w-full rounded-xl border border-line bg-surface p-3 text-base";
const dayText = (k: string) => `${bnNum(Number(k.slice(8, 10)))} ${bn.diary.months[Number(k.slice(5, 7)) - 1]} ${bnNum(Number(k.slice(0, 4)))}`;
const LABEL: Record<BookStatus, string> = { reading: bn.shelf.reading, wishlist: bn.shelf.wishlist, finished: bn.shelf.finished };

/** পড়ার তাক (দিনলিপি-ঘ ধাপ ১): বই যোগ, অবস্থা বদল, নোট, মোছা। সব বই আপাতত private */
export function ShelfView() {
  const tz = useSiteTimezone();
  const [items, setItems] = useState<BookWithId[] | undefined>();
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [filter, setFilter] = useState<BookStatus>("reading");
  const [actionErr, setActionErr] = useState(false);
  const [siteMsg, setSiteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [coverFor, setCoverFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [today] = useState(() => dayKey(Date.now(), tz));

  useEffect(() => {
    let dead = false;
    getBookRepo()
      .then((r) => r.list())
      .then((l) => {
        if (dead) return;
        setItems(l);
        setFailed(false);
      })
      .catch(() => {
        if (dead) return;
        setFailed(true);
        setItems((p) => p ?? []);
      });
    return () => {
      dead = true;
    };
  }, [version]);

  const reload = () => setVersion((v) => v + 1);
  const all = items ?? [];
  const counts = countByStatus(all);
  const options: StatusCardOption<BookStatus>[] = (["reading", "wishlist", "finished"] as const).map((s) => ({ value: s, label: LABEL[s], count: bnNum(counts[s]) }));
  const shown = all.filter((b) => b.status === filter);
  const list = filter === "finished" ? sortFinished(shown) : shown;
  const year = Number(today.slice(0, 4));

  /** `affectsSite` = বদলটা পাবলিক সাইটে প্রভাব ফেলে (বইটা পাবলিক ছিল/হলো) ⇒ হালনাগাদ-ট্রিগার (autosave-এ নয়, শুধু স্পষ্ট ক্রিয়ায় — Dev Rule ১৮) */
  async function act(fn: () => Promise<unknown>, affectsSite = false) {
    setActionErr(false);
    setSiteMsg(null);
    try {
      await fn();
      reload();
    } catch {
      setActionErr(true);
      return;
    }
    if (affectsSite) {
      const ok = await triggerSiteRebuild(); // অনুরোধ ব্যর্থ হলেও বদল সংরক্ষিত; build-status সতর্কতা দেখাবে
      setSiteMsg({ ok, text: ok ? bn.shelf.siteNote : bn.build.triggerFailed });
    }
  }
  const isPub = (b: BookWithId) => b.visibility === "public";
  const setStatus = (b: BookWithId, status: BookStatus) =>
    act(
      async () => (await getBookRepo()).update(b.id, { status, ...(status === "reading" && !b.startDay ? { startDay: today } : {}), ...(status === "finished" ? { endDay: today } : {}) }),
      isPub(b),
    );
  const setVisibility = (b: BookWithId, visibility: BookVisibility) => act(async () => (await getBookRepo()).update(b.id, { visibility }), true);

  return (
    <>
      <p className="mb-4 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-muted">🏆 {bn.shelf.yearCount(bnNum(finishedInYear(all, year)), bnNum(year))}</p>
      <StatusCards label={bn.shelf.filterLabel} value={filter} options={options} onChange={setFilter} />
      <div className="mt-4">
        {adding ? (
          <BookForm status={filter} today={today} onAdded={() => { setAdding(false); reload(); }} onCancel={() => setAdding(false)} />
        ) : (
          <AddToggle label={bn.shelf.addTitle} onClick={() => setAdding(true)} />
        )}
      </div>
      {failed && <p role="alert" className="mt-4 text-accent-text">{bn.shelf.loadFailed}</p>}
      {actionErr && <p role="alert" className="mt-4 text-accent-text">{bn.shelf.actionFailed}</p>}
      {siteMsg && <p role={siteMsg.ok ? "status" : "alert"} className={`mt-4 ${siteMsg.ok ? "text-muted" : "text-accent-text"}`}>{siteMsg.text}</p>}
      {items !== undefined && list.length === 0 && !failed && <EmptyState icon="library" text={bn.shelf.empty} />}
      <ul className="mt-4 space-y-4">
        {list.map((b) => (
          <li key={b.id} className="rounded-2xl border border-line border-l-4 border-l-btn-bg bg-surface p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-btn-bg font-serif text-xl font-bold text-btn-tx">
                {Array.from(b.title)[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-serif text-xl font-bold leading-snug">{b.title}</p>
                {b.author && <p className="text-sm text-muted">{bn.shelf.byAuthor(b.author)}</p>}
                <p className="mt-1 text-xs text-muted">
                  {isPub(b) ? bn.shelf.visibilityPublic : bn.shelf.visibilityPrivate}
                  {b.startDay && ` · ${bn.shelf.started(dayText(b.startDay))}`}
                  {b.status === "finished" && b.endDay && ` · ${bn.shelf.ended(dayText(b.endDay))}`}
                </p>
              </div>
            </div>
            {b.note && noteFor !== b.id && <ClampText text={b.note} more={bn.ideas.more} less={bn.ideas.less} className="mt-3 font-serif text-base" />}
            {coverFor === b.id && (
              <div className="mt-3">
                <CoverPicker
                  value={b.coverMediaId ?? null}
                  disabled={false}
                  shape="square"
                  labels={bn.shelf.cover}
                  onChange={(id) => void act(async () => (await getBookRepo()).update(b.id, { coverMediaId: id }), isPub(b))}
                />
              </div>
            )}
            {noteFor === b.id && <NoteEditor book={b} onDone={() => { setNoteFor(null); reload(); if (isPub(b)) void act(async () => undefined, true); }} />}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              {b.status === "wishlist" && <Act label={bn.shelf.startReading} onClick={() => void setStatus(b, "reading")} primary />}
              {b.status === "reading" && <Act label={bn.shelf.markFinished} onClick={() => void setStatus(b, "finished")} primary />}
              {b.status === "finished" && <Act label={bn.shelf.backToReading} onClick={() => void setStatus(b, "reading")} />}
              <Act label={bn.shelf.noteBtn} onClick={() => setNoteFor(noteFor === b.id ? null : b.id)} />
              <Act label={bn.shelf.coverBtn} onClick={() => setCoverFor(coverFor === b.id ? null : b.id)} />
              {isPub(b) ? (
                <Act label={bn.shelf.makePrivate} onClick={() => void setVisibility(b, "private")} />
              ) : (
                <ConfirmButton
                  label={bn.shelf.makePublic}
                  question={bn.shelf.makePublicQ}
                  onConfirm={() => void setVisibility(b, "public")}
                  className="min-h-11 rounded-full border border-line px-4 text-sm"
                />
              )}
              <ConfirmButton
                label={bn.shelf.remove}
                question={bn.shelf.removeQ}
                onConfirm={() => void act(async () => (await getBookRepo()).delete(b.id), isPub(b))}
                className="min-h-11 rounded-full border border-line px-4 text-sm"
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Act({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-11 rounded-full px-4 text-sm ${primary ? "bg-btn-bg text-btn-tx" : "border border-line"}`}>
      {label}
    </button>
  );
}

function NoteEditor({ book, onDone }: { book: BookWithId; onDone: () => void }) {
  const [text, setText] = useState(book.note);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  async function save() {
    if (busy) return;
    setBusy(true);
    setErr(false);
    try {
      await (await getBookRepo()).update(book.id, { note: text });
      onDone();
    } catch {
      setErr(true);
      setBusy(false);
    }
  }
  return (
    <div className="mt-2">
      <label className="block text-sm">
        {bn.shelf.noteLabel}
        <textarea value={text} maxLength={BOOK_NOTE_MAX} rows={4} onChange={(e) => setText(e.target.value)} className={`${field} mt-1 font-serif`} />
      </label>
      {err && <p role="alert" className="mt-1 text-accent-text">{bn.shelf.saveFailed}</p>}
      <button type="button" onClick={() => void save()} aria-disabled={busy} className="mt-2 min-h-11 rounded-full bg-btn-bg px-4 text-sm text-btn-tx aria-disabled:opacity-60">
        {bn.shelf.noteSave}
      </button>
    </div>
  );
}

function BookForm({ status, today, onAdded, onCancel }: { status: BookStatus; today: string; onAdded: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [desc, setDesc] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const idRef = useRef<string>("");

  async function submit() {
    if (busy) return;
    if (!title.trim()) {
      setErr(bn.shelf.titleRequired);
      return;
    }
    if (!idRef.current) idRef.current = newId(); // ব্যর্থ হলে একই id-তে retry ⇒ duplicate হয় না
    setBusy(true);
    setErr(null);
    try {
      await (await getBookRepo()).create({
        id: idRef.current,
        title,
        author,
        note: desc,
        ...(cover ? { coverMediaId: cover } : {}),
        status,
        ...(status === "reading" ? { startDay: today } : {}),
        ...(status === "finished" ? { endDay: today } : {}),
      });
      idRef.current = "";
      setTitle("");
      setAuthor("");
      setDesc("");
      setCover(null);
      onAdded();
    } catch {
      setErr(bn.shelf.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={bn.shelf.addTitle} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-sm text-muted">📚 {bn.shelf.addTitle}</h2>
      <label className="mb-3 block text-sm">
        {bn.shelf.titleLabel}
        <input value={title} maxLength={BOOK_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} className={`${field} mt-1`} />
      </label>
      <label className="mb-3 block text-sm">
        {bn.shelf.authorLabel}
        <input value={author} maxLength={BOOK_AUTHOR_MAX} onChange={(e) => setAuthor(e.target.value)} className={`${field} mt-1`} />
      </label>
      <label className="mb-3 block text-sm">
        {bn.shelf.descLabel}
        <textarea value={desc} maxLength={BOOK_NOTE_MAX} rows={3} onChange={(e) => setDesc(e.target.value)} className={`${field} mt-1 font-serif`} />
      </label>
      <div className="mb-3">
        <CoverPicker value={cover} disabled={busy} shape="square" labels={bn.shelf.cover} onChange={setCover} />
      </div>
      <p className="mb-3 text-sm text-muted">{bn.shelf.addsTo(LABEL[status])}</p>
      {err && <p role="alert" className="mb-3 text-accent-text">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => void submit()} aria-disabled={busy} className="min-h-11 rounded-full bg-btn-bg px-5 text-btn-tx aria-disabled:opacity-60">
          {busy ? bn.shelf.adding : bn.shelf.add}
        </button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-full border border-line px-5">
          {bn.ideas.cancel}
        </button>
      </div>
    </section>
  );
}
