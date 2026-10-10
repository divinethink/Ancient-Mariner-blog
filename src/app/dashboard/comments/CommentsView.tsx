"use client";

// মন্তব্য-ব্যবস্থাপনা (P11b-২; Mockup §৭): সরাসরি-প্রকাশ মন্তব্যের তালিকা — লুকান/ফেরান, মুছুন, লেখক-উত্তর।
// পড়া: owner-CSR (rules); লেখা: `/api/owner/comments` (privileged)। উত্তরের commentId আগে বানানো ⇒ double-tap/retry-তে duplicate নয়।
import { useCallback, useEffect, useState } from "react";
import { getCommentRepo } from "@/data/commentRepo.wire";
import type { CommentWithId } from "@/data/commentRepo";
import { getPostRepo } from "@/data/postRepo.wire";
import { triggerSiteRebuild } from "@/data/rebuildClient";
import { bn } from "@/i18n/bn";
import { CONTENT_MAX } from "@/lib/comments";
import { formatDateTime } from "@/lib/datetime";
import { newId } from "@/lib/id";
import { useSiteTimezone } from "../SiteSettingsProvider";

const T = bn.comments;
const btn = "min-h-11 rounded-full border border-line px-4 disabled:opacity-50";
const btnPrimary = "min-h-11 rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50";
type Tab = "all" | "shown" | "hidden";
type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; items: CommentWithId[]; titles: Map<string, string> };

async function call(body: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/owner/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(String(res.status));
}

export function CommentsView() {
  const tz = useSiteTimezone();
  const [st, setSt] = useState<Load>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("all");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyId, setReplyId] = useState(() => newId());
  const [changed, setChanged] = useState(false);

  const load = useCallback(async (): Promise<Load> => {
    try {
      const [items, posts] = await Promise.all([getCommentRepo().then((r) => r.list()), getPostRepo().then((r) => r.list({ limit: 100 }))]);
      return { kind: "ready", items, titles: new Map(posts.map((p) => [p.id, p.title || bn.library.untitled])) };
    } catch {
      return { kind: "error" };
    }
  }, []);

  useEffect(() => {
    void load().then(setSt);
  }, [load]);

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setChanged(true);
      setSt(await load());
    } catch {
      setMsg({ kind: "err", text: T.failed });
    } finally {
      setBusy(false);
    }
  }

  async function publishNow() {
    setBusy(true);
    setMsg(null);
    const ok = await triggerSiteRebuild();
    setMsg(ok ? { kind: "ok", text: T.publishedNow } : { kind: "err", text: T.failed });
    if (ok) setChanged(false);
    setBusy(false);
  }

  if (st.kind === "loading") return <p role="status" className="text-muted">{bn.editor.loading}</p>;
  if (st.kind === "error")
    return (
      <p role="alert" className="text-muted">
        {T.loadFailed}{" "}
        <button type="button" className="min-h-11 text-accent-text underline" onClick={() => { setSt({ kind: "loading" }); void load().then(setSt); }}>
          {T.retry}
        </button>
      </p>
    );

  const shown = (c: CommentWithId) => c.status === "approved";
  const list = st.items.filter((c) => (tab === "all" ? true : tab === "shown" ? shown(c) : !shown(c)));
  const tabs: [Tab, string][] = [["all", T.tabAll], ["shown", T.tabShown], ["hidden", T.tabHidden]];

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={T.title} className="flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`${btn} ${tab === id ? "bg-line font-semibold" : ""}`}>
            {label}
          </button>
        ))}
      </div>

      {changed && (
        <div className="space-y-2 rounded-2xl border border-line bg-surface p-3">
          <p className="text-sm text-muted">{T.siteNote}</p>
          <button type="button" className={btn} disabled={busy} onClick={() => void publishNow()}>
            {busy ? T.publishing : T.publishNow}
          </button>
        </div>
      )}
      {msg && <p role={msg.kind === "err" ? "alert" : "status"} className={msg.kind === "err" ? "text-accent-text" : "text-muted"}>{msg.text}</p>}

      {list.length === 0 ? (
        <p className="text-muted">{T.emptyList}</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {list.map((c) => (
            <li key={c.id} className="space-y-2 p-3">
              <p className="text-sm text-muted">
                <span className="font-semibold">{c.authorName}</span>
                {c.byOwner && <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-xs">{T.ownerBadge}</span>}
                {!shown(c) && <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-xs">{T.hiddenBadge}</span>}
                {c.parentCommentId && <span className="ml-2">↳</span>}
                {" · "}
                {formatDateTime(c.createdAt, tz)}
              </p>
              <p className="whitespace-pre-wrap break-words">{c.content}</p>
              <p className="truncate text-xs text-muted">{T.onPost(st.titles.get(c.postId) ?? T.unknownPost)}</p>
              <div className="flex flex-wrap gap-2">
                {shown(c) ? (
                  <button type="button" className={btn} disabled={busy} onClick={() => void run(() => call({ action: "status", id: c.id, status: "spam" }))}>
                    {T.hide}
                  </button>
                ) : (
                  <button type="button" className={btn} disabled={busy} onClick={() => void run(() => call({ action: "status", id: c.id, status: "approved" }))}>
                    {T.unhide}
                  </button>
                )}
                {shown(c) && !c.parentCommentId && (
                  <button type="button" className={btn} disabled={busy} onClick={() => { setReplyFor(replyFor === c.id ? null : c.id); setReplyText(""); }}>
                    {T.reply}
                  </button>
                )}
                <button type="button" className={btn} disabled={busy} onClick={() => confirm(T.confirmRemove) && void run(() => call({ action: "delete", id: c.id }))}>
                  {T.remove}
                </button>
              </div>
              {replyFor === c.id && (
                <div className="space-y-2">
                  <label htmlFor={`rp-${c.id}`} className="block text-sm text-muted">{T.ownerReplyLabel}</label>
                  <textarea id={`rp-${c.id}`} value={replyText} onChange={(e) => setReplyText(e.target.value)} maxLength={CONTENT_MAX} rows={3} className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-base" />
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={busy || !replyText.trim()}
                    onClick={() =>
                      void run(async () => {
                        await call({ action: "reply", commentId: replyId, parentCommentId: c.id, content: replyText });
                        setReplyId(newId()); // সফলের পর নতুন ID; ব্যর্থ হলে একই ID-তে retry
                        setReplyFor(null);
                        setReplyText("");
                      })
                    }
                  >
                    {T.sendReply}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
