"use client";

import { useEffect, useRef, useState } from "react";
import type { BookWithId } from "@/data/bookRepo";
import { getBookRepo } from "@/data/bookRepo.wire";
import type { QuoteWithId } from "@/data/quoteRepo";
import { getQuoteRepo } from "@/data/quoteRepo.wire";
import { bn } from "@/i18n/bn";
import { QUOTE_MAX, QUOTE_PAGE_MAX } from "@/lib/books";
import { newId } from "@/lib/id";
import { ConfirmButton } from "../../ConfirmButton";

const field = "w-full rounded-xl border border-line bg-surface p-3 text-base";

/** উদ্ধৃতি-খাতা (দিনলিপি-ঘ ধাপ ১): সবসময় private; বই ঐচ্ছিক, নাম-কপি রাখা হয় */
export function QuoteList() {
  const [items, setItems] = useState<QuoteWithId[] | undefined>();
  const [books, setBooks] = useState<BookWithId[]>([]);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [actionErr, setActionErr] = useState(false);

  useEffect(() => {
    let dead = false;
    getQuoteRepo()
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

  useEffect(() => {
    let dead = false;
    getBookRepo()
      .then((r) => r.list())
      .then((l) => {
        if (!dead) setBooks(l);
      })
      .catch(() => undefined); // বই না এলেও উদ্ধৃতি লেখা যায় (বই ঐচ্ছিক)
    return () => {
      dead = true;
    };
  }, []);

  async function remove(id: string) {
    setActionErr(false);
    try {
      await (await getQuoteRepo()).delete(id);
      setVersion((v) => v + 1);
    } catch {
      setActionErr(true);
    }
  }

  return (
    <>
      <QuoteForm books={books} onAdded={() => setVersion((v) => v + 1)} />
      {failed && <p role="alert" className="mt-4 text-accent-text">{bn.shelf.loadFailed}</p>}
      {actionErr && <p role="alert" className="mt-4 text-accent-text">{bn.shelf.actionFailed}</p>}
      {items !== undefined && items.length === 0 && !failed && <p className="mt-6 text-muted">{bn.shelf.quotesEmpty}</p>}
      <ul className="mt-6 space-y-3">
        {(items ?? []).map((q) => (
          <li key={q.id} className="rounded-2xl border border-line bg-surface p-4">
            <p className="whitespace-pre-line font-serif text-base">“{q.text}”</p>
            {(q.bookTitle || q.page) && (
              <p className="mt-1 text-sm text-muted">
                {q.bookTitle && `— ${q.bookTitle}`}
                {q.bookTitle && q.page && " · "}
                {q.page && bn.shelf.quotePage(q.page)}
              </p>
            )}
            <ConfirmButton
              label={bn.shelf.remove}
              question={bn.shelf.quoteRemoveQ}
              onConfirm={() => void remove(q.id)}
              className="mt-2 min-h-11 rounded-full border border-line px-4 text-sm"
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function QuoteForm({ books, onAdded }: { books: BookWithId[]; onAdded: () => void }) {
  const [text, setText] = useState("");
  const [bookId, setBookId] = useState("");
  const [page, setPage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const idRef = useRef<string>("");

  async function submit() {
    if (busy) return;
    if (!text.trim()) {
      setErr(bn.shelf.quoteTextRequired);
      return;
    }
    if (!idRef.current) idRef.current = newId(); // ব্যর্থ হলে একই id-তে retry ⇒ duplicate হয় না
    const book = books.find((b) => b.id === bookId);
    setBusy(true);
    setErr(null);
    try {
      await (await getQuoteRepo()).create({
        id: idRef.current,
        text,
        page,
        ...(book ? { bookId: book.id, bookTitle: book.title } : {}),
      });
      idRef.current = "";
      setText("");
      setPage("");
      onAdded();
    } catch {
      setErr(bn.shelf.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={bn.shelf.quotesTitle} className="rounded-2xl border border-line bg-surface p-4">
      <label className="mb-3 block text-sm">
        {bn.shelf.quoteTextLabel}
        <textarea value={text} maxLength={QUOTE_MAX} rows={4} onChange={(e) => setText(e.target.value)} className={`${field} mt-1 font-serif`} />
      </label>
      <label className="mb-3 block text-sm">
        {bn.shelf.quoteBookLabel}
        <select value={bookId} onChange={(e) => setBookId(e.target.value)} className={`${field} mt-1`}>
          <option value="">{bn.shelf.quoteNoBook}</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
      </label>
      <label className="mb-3 block text-sm">
        {bn.shelf.quotePageLabel}
        <input value={page} maxLength={QUOTE_PAGE_MAX} onChange={(e) => setPage(e.target.value)} className={`${field} mt-1`} />
      </label>
      {err && <p role="alert" className="mb-3 text-accent-text">{err}</p>}
      <button type="button" onClick={() => void submit()} aria-disabled={busy} className="min-h-11 rounded-full bg-btn-bg px-5 text-btn-tx aria-disabled:opacity-60">
        {bn.shelf.quoteAdd}
      </button>
    </section>
  );
}
