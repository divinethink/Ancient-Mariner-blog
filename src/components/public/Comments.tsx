"use client";

// পোস্টের নিচে মন্তব্য (P11b-২; Arch §৬, §১৪): তালিকা build-সময়ে static HTML (JS ছাড়াও পড়া যায়); ফর্ম ফোকাসে Turnstile লোড (পেজ হালকা থাকে)।
// owner-সিদ্ধান্ত: মডারেশন নেই — জমার পরই পাঠকের নিজের ব্রাউজারে মন্তব্য দেখা যায়, সবার জন্য পরের rebuild-এ।
// commentId আগে বানানো ⇒ double-submit/retry-তে server-এ duplicate হয় না। কোনো HTML রেন্ডার নেই — React plain-text escape করে।
import { useRef, useState, type FormEvent } from "react";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { newId } from "@/lib/id";
import { cleanContent, cleanName, CONTENT_MAX, NAME_MAX } from "@/lib/comments";

export type CommentView = { id: string; authorName: string; content: string; dateLabel: string; byOwner?: boolean; mine?: boolean };
export type ThreadView = { comment: CommentView; replies: CommentView[] };

const T = bn.comments;
const NAME_KEY = "commentName";
const field = "min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base";
const btn = "min-h-11 rounded-full border border-line px-4 disabled:opacity-50";
const btnPrimary = "min-h-11 rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50";

type TurnstileApi = {
  render(el: HTMLElement, o: { sitekey: string; theme?: string; callback: (t: string) => void; "expired-callback": () => void; "error-callback": () => void }): string;
  reset(id?: string): void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile script"));
    document.head.appendChild(s);
  });
}

function Item({ c, onReply }: { c: CommentView; onReply?: () => void }) {
  return (
    <div>
      <p className="text-sm text-muted">
        <span className="font-semibold">{c.authorName}</span>
        {c.byOwner && <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-xs">{T.ownerBadge}</span>}
        {" · "}
        {c.dateLabel}
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words">{c.content}</p>
      {c.mine && <p className="mt-1 text-xs text-muted">{T.mine}</p>}
      {onReply && (
        <button type="button" onClick={onReply} className="mt-1 inline-flex min-h-11 items-center text-sm text-accent-text">
          {T.reply}
        </button>
      )}
    </div>
  );
}

export function Comments({ postId, thread, open, tz }: { postId: string; thread: ThreadView[]; open: boolean; tz: string }) {
  const [local, setLocal] = useState<{ parent?: string; view: CommentView }[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [captcha, setCaptcha] = useState<"idle" | "loading" | "ready" | "off">("idle");
  const token = useRef<string | null>(null);
  const widget = useRef<string | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  const [commentId, setCommentId] = useState(() => newId());
  const formRef = useRef<HTMLFormElement>(null);

  async function ensureCaptcha() {
    if (captcha !== "idle") return;
    setCaptcha("loading");
    try {
      try {
        const saved = localStorage.getItem(NAME_KEY);
        if (saved && !name) setName(saved.slice(0, NAME_MAX));
      } catch {
        /* storage বন্ধ */
      }
      const res = await fetch("/api/comment", { cache: "no-store" });
      const { siteKey } = (await res.json()) as { siteKey?: string };
      if (!res.ok || !siteKey) throw new Error("no site key");
      await loadScript();
      if (!box.current || !window.turnstile) throw new Error("no turnstile");
      widget.current = window.turnstile.render(box.current, {
        sitekey: siteKey,
        theme: "auto",
        callback: (t) => (token.current = t),
        "expired-callback": () => (token.current = null),
        "error-callback": () => (token.current = null),
      });
      setCaptcha("ready");
    } catch {
      setCaptcha("off");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const authorName = cleanName(name);
    const content = cleanContent(text);
    if (!authorName || authorName.length > NAME_MAX || !content || content.length > CONTENT_MAX) return setMsg({ kind: "err", text: T.errors.invalid });
    if (!token.current) return setMsg({ kind: "err", text: T.verifying });
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/comment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commentId, postId, parentCommentId: replyTo?.id, authorName, content, turnstileToken: token.current }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        const known = j.error && j.error in T.errors ? (j.error as keyof typeof T.errors) : "generic";
        if (known === "captcha_failed") {
          token.current = null;
          if (widget.current) window.turnstile?.reset(widget.current);
        }
        return setMsg({ kind: "err", text: T.errors[known] });
      }
      setLocal((l) => [...l, { parent: replyTo?.id, view: { id: commentId, authorName, content, dateLabel: formatDate(new Date(), tz), mine: true } }]);
      try {
        localStorage.setItem(NAME_KEY, authorName);
      } catch {
        /* storage বন্ধ */
      }
      setCommentId(newId()); // পরের মন্তব্যের নতুন ID; ব্যর্থ হলে একই ID রেখে retry
      token.current = null;
      if (widget.current) window.turnstile?.reset(widget.current);
      setText("");
      setReplyTo(null);
      setMsg({ kind: "ok", text: T.sent });
    } catch {
      setMsg({ kind: "err", text: T.errors.generic });
    } finally {
      setBusy(false);
    }
  }

  const tops = [
    ...thread,
    ...local.filter((l) => !l.parent).map((l) => ({ comment: l.view, replies: [] as CommentView[] })),
  ].map((t) => ({ comment: t.comment, replies: [...t.replies, ...local.filter((l) => l.parent === t.comment.id).map((l) => l.view)] }));
  const total = tops.reduce((n, t) => n + 1 + t.replies.length, 0);

  return (
    <section id="comments" aria-labelledby="comments-h" className="mt-10 border-t border-line pt-6">
      <h2 id="comments-h" className="font-serif text-2xl font-bold">
        {T.heading(total)}
      </h2>
      {tops.length === 0 ? (
        <p className="mt-3 text-muted">{open ? T.empty : T.closed}</p>
      ) : (
        <ul className="mt-4 space-y-5">
          {tops.map(({ comment, replies }) => (
            <li key={comment.id}>
              <Item
                c={comment}
                onReply={
                  open
                    ? () => {
                        setReplyTo({ id: comment.id, name: comment.authorName });
                        void ensureCaptcha();
                        formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }
                    : undefined
                }
              />
              {replies.length > 0 && (
                <ul className="mt-3 space-y-4 border-l-2 border-line pl-4">
                  {replies.map((r) => (
                    <li key={r.id}>
                      <Item c={r} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <form ref={formRef} onSubmit={submit} onFocusCapture={() => void ensureCaptcha()} className="mt-6 space-y-3 rounded-2xl border border-line bg-surface p-4">
          {replyTo && (
            <p className="flex items-center justify-between gap-2 text-sm">
              <span>{T.replyingTo(replyTo.name)}</span>
              <button type="button" className={btn} onClick={() => setReplyTo(null)}>
                {T.cancelReply}
              </button>
            </p>
          )}
          <div>
            <label htmlFor="cm-name" className="mb-1 block text-sm text-muted">
              {T.nameLabel}
            </label>
            <input id="cm-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} autoComplete="nickname" className={field} />
          </div>
          <div>
            <label htmlFor="cm-text" className="mb-1 block text-sm text-muted">
              {T.contentLabel}
            </label>
            <textarea id="cm-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={CONTENT_MAX} rows={4} className={`${field} py-2`} />
            <p className="mt-1 text-xs text-muted">
              {T.counter(text.length, CONTENT_MAX)} · {T.hint}
            </p>
          </div>
          <div ref={box} />
          {captcha === "off" && <p role="status" className="text-sm text-muted">{T.formOff}</p>}
          <button type="submit" disabled={busy || captcha === "off"} className={btnPrimary}>
            {busy ? T.sending : T.send}
          </button>
          {msg && (
            <p role={msg.kind === "err" ? "alert" : "status"} className={msg.kind === "err" ? "text-accent-text" : "text-muted"}>
              {msg.text}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
