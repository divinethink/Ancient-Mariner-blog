"use client";

// Inbox (Mockup §৭.১৩/§৭.১৯): অসংগঠিত `notes`। এখানেই নোট লেখা যায় (ফোন-শেয়ার P7b-তে একই `create`-এ আসবে);
// [সাজানো হয়েছে] দিলে Inbox থেকে সরে — 'সাজানো নোট দেখুন'-এ থাকে, হারায় না।
import { useEffect, useRef, useState, type FormEvent } from "react";
import { NoteContentSchema, type NoteWithId } from "@/data/noteRepo";
import { getNoteRepo } from "@/data/noteRepo.wire";
import { EmptyState } from "@/components/ui/EmptyState";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { newId } from "@/lib/id";
import { IDEAS_PAGE, NOTE_CONTENT_MAX } from "@/lib/idea";
import { ConfirmButton } from "./ConfirmButton";
import { useSiteTimezone } from "./SiteSettingsProvider";

type Load =
  { kind: "loading" } | { kind: "error" } | { kind: "ready"; items: NoteWithId[]; more: boolean };

const ghost = "min-h-11 rounded-full border border-line px-4 disabled:opacity-50";
const primary =
  "min-h-11 rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50";

export function InboxList() {
  const t = bn.ideas;
  const tz = useSiteTimezone();
  const [organized, setOrganized] = useState(false);
  const [limit, setLimit] = useState(IDEAS_PAGE);
  const [tick, setTick] = useState(0);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const pendingId = useRef<string>("");

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const items = await (await getNoteRepo()).list({ organized, limit });
        if (!dead) setLoad({ kind: "ready", items, more: items.length >= limit });
      } catch {
        if (!dead) setLoad({ kind: "error" });
      }
    })();
    return () => {
      dead = true;
    };
  }, [organized, limit, tick]);

  const reload = () => setTick((n) => n + 1);

  function switchView(next: boolean) {
    setOrganized(next);
    setLimit(IDEAS_PAGE);
    setErr(null);
    setLoad({ kind: "loading" });
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (adding) return; // double-submit গার্ড
    const parsed = NoteContentSchema.safeParse(text);
    if (!parsed.success) {
      setErr(t.invalid);
      return;
    }
    if (pendingId.current === "") pendingId.current = newId(); // retry-তে একই id ⇒ duplicate নয়
    setAdding(true);
    setErr(null);
    try {
      await (await getNoteRepo()).create({ id: pendingId.current, content: parsed.data });
      pendingId.current = "";
      setText("");
      if (!organized) reload();
    } catch {
      setErr(t.saveFailed);
    }
    setAdding(false);
  }

  async function act(
    id: string,
    fn: (r: Awaited<ReturnType<typeof getNoteRepo>>) => Promise<unknown>,
  ) {
    if (busy) return;
    setBusy(id);
    setErr(null);
    try {
      await fn(await getNoteRepo());
      setLoad((l) =>
        l.kind === "ready" ? { ...l, items: l.items.filter((x) => x.id !== id) } : l,
      );
    } catch {
      setErr(t.actionFailed);
    }
    setBusy(null);
  }

  return (
    <>
      {!organized && (
        <form onSubmit={onAdd} className="mb-5">
          <label htmlFor="inbox-add" className="sr-only">
            {t.inboxLabel}
          </label>
          <textarea
            id="inbox-add"
            rows={3}
            value={text}
            maxLength={NOTE_CONTENT_MAX}
            placeholder={t.inboxPlaceholder}
            onChange={(e) => {
              setText(e.target.value);
              setErr(null);
            }}
            className="w-full rounded-lg border border-line bg-surface p-3 text-base"
          />
          <div className="mt-2 flex justify-end">
            <button type="submit" disabled={adding} className={primary}>
              {adding ? t.saving : t.inboxAdd}
            </button>
          </div>
        </form>
      )}
      {err && (
        <p role="alert" className="mb-3 text-accent-text">
          {err}
        </p>
      )}

      {load.kind === "loading" && <p className="text-muted">{t.loading}</p>}
      {load.kind === "error" && (
        <div role="alert">
          <p className="mb-3 text-accent-text">{t.loadFailed}</p>
          <button type="button" onClick={() => switchView(organized)} className={ghost}>
            {t.retry}
          </button>
        </div>
      )}
      {load.kind === "ready" &&
        (load.items.length === 0 ? (
          <EmptyState icon="inbox" text={organized ? t.organizedEmpty : t.inboxEmpty} />
        ) : (
          <ul className="space-y-3">
            {load.items.map((n) => (
              <li key={n.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span>{formatDate(n.createdAt, tz)}</span>
                  {n.kind === "shared" && (
                    <span className="rounded-full border border-line px-2">{t.shared}</span>
                  )}
                </div>
                {n.title && <h2 className="font-serif text-lg font-bold">{n.title}</h2>}
                <p className="whitespace-pre-wrap break-words">{n.content}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => act(n.id, (r) => r.setOrganized(n.id, !organized))}
                    className={organized ? ghost : primary}
                  >
                    {organized ? t.unorganize : t.organize}
                  </button>
                  <ConfirmButton
                    label={t.delete}
                    question={t.confirmDeleteNote}
                    onConfirm={() => act(n.id, (r) => r.delete(n.id))}
                    disabled={busy !== null}
                    className={ghost}
                  />
                </div>
              </li>
            ))}
          </ul>
        ))}
      {load.kind === "ready" && load.more && (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={() => setLimit((n) => n + IDEAS_PAGE)} className={ghost}>
            {t.more}
          </button>
        </div>
      )}
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => switchView(!organized)}
          className="min-h-11 text-sm text-muted underline"
        >
          {organized ? t.showInbox : t.showOrganized}
        </button>
      </div>
    </>
  );
}
