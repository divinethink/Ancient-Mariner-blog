"use client";

import { useEffect, useRef, useState } from "react";
import type { LetterWithId } from "@/data/letterRepo";
import { getLetterRepo } from "@/data/letterRepo.wire";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { newId } from "@/lib/id";
import { LETTER_BODY_MAX, LETTER_TITLE_MAX, isLetterOpen, letterDaysLeft, minLetterDay, openAtFor } from "@/lib/letters";
import { ConfirmButton } from "../ConfirmButton";
import { useSiteTimezone } from "../SiteSettingsProvider";

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
const field = "w-full rounded-xl border border-line bg-surface p-3 text-base";

/** ভবিষ্যতের চিঠি (দিনলিপি-গ): লেখা, তালাবদ্ধ তালিকা, খোলার-সময়ে পড়া। তালা শুধু UI-তে — তালাবদ্ধ চিঠির লেখা DOM-এ আঁকা হয় না */
export function LetterList() {
  const tz = useSiteTimezone();
  const [items, setItems] = useState<LetterWithId[] | undefined>();
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0); // বদলালে তালিকা নতুন করে আনে
  const [now, setNow] = useState(() => Date.now());
  const [shown, setShown] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState(false);

  useEffect(() => {
    let dead = false;
    getLetterRepo()
      .then((r) => r.list())
      .then((l) => {
        if (dead) return;
        setItems(l);
        setNow(Date.now());
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

  async function open(l: LetterWithId) {
    setShown(l.id);
    if (l.openedAt) return;
    try {
      await (await getLetterRepo()).markOpened(l.id); // idempotent; ব্যর্থ হলেও লেখা দেখা যায়, পরে আবার চিহ্নিত হবে
      reload();
    } catch {
      /* নীরব: পড়া-চিহ্ন পরের বার */
    }
  }

  async function remove(id: string) {
    setActionErr(false);
    try {
      await (await getLetterRepo()).delete(id);
      if (shown === id) setShown(null);
      reload();
    } catch {
      setActionErr(true);
    }
  }

  return (
    <>
      <LetterForm tz={tz} onCreated={reload} />
      {failed && <p role="alert" className="mt-4 text-accent-text">{bn.letters.loadFailed}</p>}
      {actionErr && <p role="alert" className="mt-4 text-accent-text">{bn.letters.actionFailed}</p>}
      {items !== undefined && items.length === 0 && !failed && <p className="mt-6 text-muted">{bn.letters.empty}</p>}
      <ul className="mt-6 space-y-3">
        {(items ?? []).map((l) => {
          const openNow = isLetterOpen(l.openAt, now);
          const isShown = shown === l.id && openNow;
          return (
            <li key={l.id} className="rounded-2xl border border-line bg-surface p-4">
              <p className="font-serif text-lg font-bold">{l.title || bn.letters.untitled}</p>
              <p className="mt-1 text-sm text-muted">
                {openNow ? (l.openedAt ? bn.letters.readBadge : bn.letters.readyBadge) : bn.letters.lockedIn(bnNum(letterDaysLeft(l.openAt, now, tz)))}
                {" · "}
                {openNow ? bn.letters.wasOpen(formatDate(l.openAt, tz)) : bn.letters.opensOn(formatDate(l.openAt, tz))}
              </p>
              {isShown && <p className="mt-3 whitespace-pre-line font-serif text-base">{l.body}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {openNow && (
                  <button
                    type="button"
                    onClick={() => (isShown ? setShown(null) : void open(l))}
                    className="min-h-11 rounded-full bg-btn-bg px-4 text-sm text-btn-tx"
                  >
                    {isShown ? bn.letters.hide : bn.letters.openBtn}
                  </button>
                )}
                <ConfirmButton
                  label={bn.letters.remove}
                  question={openNow ? bn.letters.removeQ : bn.letters.removeLockedQ}
                  onConfirm={() => void remove(l.id)}
                  className="min-h-11 rounded-full border border-line px-4 text-sm"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function LetterForm({ tz, onCreated }: { tz: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const idRef = useRef<string>("");
  const [minDay] = useState(() => minLetterDay(Date.now(), tz));

  async function submit() {
    if (busy) return;
    const text = body.trim();
    if (!text) return setErr(bn.letters.bodyRequired);
    const openAt = openAtFor(day, Date.now(), tz);
    if (!openAt) return setErr(bn.letters.dayInvalid);
    if (!idRef.current) idRef.current = newId(); // ব্যর্থ হলে একই id-তে retry ⇒ duplicate হয় না
    setBusy(true);
    setErr(null);
    try {
      await (await getLetterRepo()).create({ id: idRef.current, title, body: text, openAt });
      idRef.current = "";
      setTitle("");
      setBody("");
      setDay("");
      onCreated();
    } catch {
      setErr(bn.letters.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={bn.letters.formTitle} className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm text-muted">✉️ {bn.letters.formTitle}</h2>
      <label className="mb-3 block text-sm">
        {bn.letters.titleLabel}
        <input value={title} maxLength={LETTER_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} className={`${field} mt-1`} />
      </label>
      <label className="mb-3 block text-sm">
        {bn.letters.bodyLabel}
        <textarea value={body} maxLength={LETTER_BODY_MAX} rows={7} onChange={(e) => setBody(e.target.value)} className={`${field} mt-1 font-serif`} />
      </label>
      <label className="mb-3 block text-sm">
        {bn.letters.dayLabel}
        <input type="date" value={day} min={minDay} onChange={(e) => setDay(e.target.value)} className={`${field} mt-1`} />
      </label>
      {err && <p role="alert" className="mb-3 text-accent-text">{err}</p>}
      <button
        type="button"
        onClick={() => void submit()}
        aria-disabled={busy}
        className="min-h-11 rounded-full bg-btn-bg px-5 text-btn-tx aria-disabled:opacity-60"
      >
        {busy ? bn.letters.saving : bn.letters.save}
      </button>
    </section>
  );
}
