"use client";

// আইডিয়া-তালিকা (Mockup §৭.১৩): নতুন আগে, ৫০টা/বার + [আরও দেখান]; সম্পাদনা, মোছা (দুই-ধাপ confirm), Idea→Post convert।
// সব ডেটা-কাজ data-layer (ideaRepo / ideaConvert) দিয়ে; convert idempotent — double-tap বা retry-তে দ্বিতীয় লেখা হয় না।
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { convertIdeaToPost } from "@/data/ideaConvert";
import { IdeaTextSchema, IdeaTitleSchema, type IdeaWithId } from "@/data/ideaRepo";
import { getIdeaRepo } from "@/data/ideaRepo.wire";
import { getPostRepo } from "@/data/postRepo.wire";
import { EmptyState } from "@/components/ui/EmptyState";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { IDEA_TYPE, type IdeaType } from "@/lib/enums";
import { IDEA_TEXT_MAX, IDEA_TITLE_MAX, IDEAS_PAGE } from "@/lib/idea";
import { useAdd } from "./AddSheet";
import { ConfirmButton } from "./ConfirmButton";
import { useSiteTimezone } from "./SiteSettingsProvider";

type Load =
  { kind: "loading" } | { kind: "error" } | { kind: "ready"; items: IdeaWithId[]; more: boolean };
type Note = { id: string; text: string } | null;

const field = "w-full rounded-lg border border-line bg-surface px-3 text-base";
const ghost = "min-h-11 rounded-full border border-line px-4 disabled:opacity-50";
const primary =
  "min-h-11 rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50";

export function IdeaList() {
  const t = bn.ideas;
  const tz = useSiteTimezone();
  const router = useRouter();
  const { openIdea, ideasVersion } = useAdd();
  const [limit, setLimit] = useState(IDEAS_PAGE);
  const [tick, setTick] = useState(0);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const items = await (await getIdeaRepo()).list({ limit });
        if (!dead) setLoad({ kind: "ready", items, more: items.length >= limit });
      } catch {
        if (!dead) setLoad({ kind: "error" });
      }
    })();
    return () => {
      dead = true;
    };
  }, [limit, tick, ideasVersion]);

  // PWA shortcut 'Quick Idea' (`?new=1`): sheet খুলে param মুছে ফেলা (reload-এ আবার না খোলার জন্য)
  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.get("new") !== "1") return;
    u.searchParams.delete("new");
    window.history.replaceState(null, "", u.pathname + u.search);
    openIdea();
  }, [openIdea]);

  function retry() {
    setLoad({ kind: "loading" });
    setTick((n) => n + 1);
  }

  async function onConvert(id: string) {
    if (busy) return;
    setBusy(id);
    setNote(null);
    try {
      const [ideas, posts] = await Promise.all([getIdeaRepo(), getPostRepo()]);
      const r = await convertIdeaToPost(ideas, posts, id);
      router.push(`/dashboard/posts/${r.postId}/edit`);
    } catch {
      setNote({ id, text: t.convertFailed });
      setBusy(null);
    }
  }

  async function onDelete(id: string) {
    if (busy) return;
    setBusy(id);
    setNote(null);
    try {
      await (await getIdeaRepo()).delete(id);
      setLoad((l) =>
        l.kind === "ready" ? { ...l, items: l.items.filter((x) => x.id !== id) } : l,
      );
    } catch {
      setNote({ id, text: t.actionFailed });
    }
    setBusy(null);
  }

  async function onSaveEdit(id: string, v: { title: string; text: string; type: IdeaType }) {
    if (busy) return;
    const text = IdeaTextSchema.safeParse(v.text);
    const title = IdeaTitleSchema.safeParse(v.title);
    if (!text.success || !title.success) {
      setNote({ id, text: t.invalid });
      return;
    }
    setBusy(id);
    setNote(null);
    try {
      const next = await (
        await getIdeaRepo()
      ).update(id, { text: text.data, title: title.data === "" ? null : title.data, type: v.type });
      setLoad((l) =>
        l.kind === "ready" ? { ...l, items: l.items.map((x) => (x.id === id ? next : x)) } : l,
      );
      setEditing(null);
    } catch {
      setNote({ id, text: t.actionFailed });
    }
    setBusy(null);
  }

  if (load.kind === "loading") return <p className="text-muted">{t.loading}</p>;
  if (load.kind === "error") {
    return (
      <div role="alert">
        <p className="mb-3 text-accent-text">{t.loadFailed}</p>
        <button type="button" onClick={retry} className={ghost}>
          {t.retry}
        </button>
      </div>
    );
  }

  return (
    <>
      {load.items.length === 0 ? (
        <EmptyState icon="idea" text={t.empty} />
      ) : (
        <ul className="space-y-3">
          {load.items.map((it) => (
            <li key={it.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span className="rounded-full border border-line px-2">
                  {t.types[it.type] ?? it.type}
                </span>
                <span>{formatDate(it.createdAt, tz)}</span>
                {it.convertedToPostId && <span className="text-accent-text">{t.converted}</span>}
              </div>
              {editing === it.id ? (
                <EditForm
                  idea={it}
                  busy={busy === it.id}
                  onSave={(v) => onSaveEdit(it.id, v)}
                  onCancel={() => {
                    setEditing(null);
                    setNote(null);
                  }}
                />
              ) : (
                <>
                  {it.title && <h2 className="font-serif text-lg font-bold">{it.title}</h2>}
                  <p className="whitespace-pre-wrap break-words">{it.text}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {it.convertedToPostId ? (
                      <Link
                        href={`/dashboard/posts/${it.convertedToPostId}/edit`}
                        className={`${ghost} inline-flex items-center`}
                      >
                        {t.openPost}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => onConvert(it.id)}
                        className={primary}
                      >
                        {busy === it.id ? t.converting : t.convert}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        setEditing(it.id);
                        setNote(null);
                      }}
                      className={ghost}
                    >
                      {t.edit}
                    </button>
                    <ConfirmButton
                      label={t.delete}
                      question={t.confirmDelete}
                      onConfirm={() => onDelete(it.id)}
                      disabled={busy !== null}
                      className={ghost}
                    />
                  </div>
                </>
              )}
              {note?.id === it.id && (
                <p role="alert" className="mt-2 text-sm text-accent-text">
                  {note.text}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {load.more && (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={() => setLimit((n) => n + IDEAS_PAGE)} className={ghost}>
            {t.more}
          </button>
        </div>
      )}
    </>
  );
}

function EditForm({
  idea,
  busy,
  onSave,
  onCancel,
}: {
  idea: IdeaWithId;
  busy: boolean;
  onSave: (v: { title: string; text: string; type: IdeaType }) => void;
  onCancel: () => void;
}) {
  const t = bn.ideas;
  const [title, setTitle] = useState(idea.title ?? "");
  const [text, setText] = useState(idea.text);
  const [type, setType] = useState<IdeaType>(idea.type);
  const sub = (e: FormEvent) => {
    e.preventDefault();
    onSave({ title, text, type });
  };
  const id = `idea-${idea.id}`;
  return (
    <form onSubmit={sub} className="space-y-3">
      <div>
        <label htmlFor={`${id}-title`} className="mb-1 block text-sm text-muted">
          {t.titleLabel}
        </label>
        <input
          id={`${id}-title`}
          value={title}
          maxLength={IDEA_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          className={`${field} min-h-11`}
        />
      </div>
      <div>
        <label htmlFor={`${id}-text`} className="mb-1 block text-sm text-muted">
          {t.textLabel}
        </label>
        <textarea
          id={`${id}-text`}
          rows={5}
          value={text}
          maxLength={IDEA_TEXT_MAX}
          onChange={(e) => setText(e.target.value)}
          className={`${field} p-3`}
        />
      </div>
      <div>
        <label htmlFor={`${id}-type`} className="mb-1 block text-sm text-muted">
          {t.typeLabel}
        </label>
        <select
          id={`${id}-type`}
          value={type}
          onChange={(e) => setType(e.target.value as IdeaType)}
          className={`${field} min-h-11`}
        >
          {IDEA_TYPE.map((k) => (
            <option key={k} value={k}>
              {t.types[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primary}>
          {t.saveEdit}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className={ghost}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
