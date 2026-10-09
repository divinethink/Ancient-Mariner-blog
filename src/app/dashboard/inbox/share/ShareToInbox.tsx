"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NoteContentSchema, NoteTitleSchema } from "@/data/noteRepo";
import { getNoteRepo } from "@/data/noteRepo.wire";
import { bn } from "@/i18n/bn";
import { newId } from "@/lib/id";
import { IDEA_TITLE_MAX, NOTE_CONTENT_MAX } from "@/lib/idea";

const primary = "min-h-11 rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50";
const field = "w-full rounded-lg border border-line bg-surface p-3 text-base";

export function ShareToInbox({ initial }: { initial: { title: string; content: string } }) {
  const t = bn.ideas;
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pendingId = useRef("");

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (busy) return; // double-tap গার্ড
    const c = NoteContentSchema.safeParse(content);
    const ti = NoteTitleSchema.safeParse(title);
    if (!c.success || !ti.success) {
      setErr(t.invalid);
      return;
    }
    if (pendingId.current === "") pendingId.current = newId(); // retry-তে একই id ⇒ duplicate নয়
    setBusy(true);
    setErr(null);
    try {
      await (await getNoteRepo()).create({
        id: pendingId.current,
        content: c.data,
        title: ti.data,
        kind: "shared",
      });
      router.replace("/dashboard/inbox"); // রিলোডে আবার সেভ এড়াতে
    } catch {
      setErr(t.saveFailed);
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="mb-2 font-serif text-3xl font-bold">{bn.share.title}</h1>
      {initial.content === "" && <p className="mb-3 text-muted">{bn.share.empty}</p>}
      <form onSubmit={onSave} className="space-y-3">
        <div>
          <label htmlFor="share-title" className="mb-1 block text-sm text-muted">
            {bn.share.titleLabel}
          </label>
          <input
            id="share-title"
            value={title}
            maxLength={IDEA_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="share-content" className="mb-1 block text-sm text-muted">
            {bn.share.contentLabel}
          </label>
          <textarea
            id="share-content"
            rows={6}
            value={content}
            maxLength={NOTE_CONTENT_MAX}
            onChange={(e) => {
              setContent(e.target.value);
              setErr(null);
            }}
            className={field}
          />
        </div>
        {err && (
          <p role="alert" className="text-accent-text">
            {err}
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          <Link href="/dashboard/inbox" className="min-h-11 content-center text-muted underline">
            {t.cancel}
          </Link>
          <button type="submit" disabled={busy} className={primary}>
            {busy ? t.saving : bn.share.save}
          </button>
        </div>
      </form>
    </>
  );
}
