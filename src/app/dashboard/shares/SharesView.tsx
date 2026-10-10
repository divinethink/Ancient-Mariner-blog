"use client";

// শেয়ার-লিংক (P11c-২; Mockup §৭): লেখা + মেয়াদ বেছে লিংক বানানো (একবারই দেখা যায়), তালিকা, revoke।
// token UI-তে আগে তৈরি ⇒ double-submit/retry-তে একই doc (duplicate নয়)। `?post=<id>` = Publish panel থেকে আগে-বাছা লেখা।
import { useCallback, useEffect, useState } from "react";
import { getPostRepo } from "@/data/postRepo.wire";
import { getShareLinkRepo } from "@/data/shareLinkRepo.wire";
import type { ShareLinkWithId } from "@/data/shareLinkRepo";
import { generateShareToken } from "@/data/shareToken";
import { bn } from "@/i18n/bn";
import { formatDate } from "@/lib/datetime";
import { SHARE_DEFAULT_DAYS, SHARE_EXPIRY_DAYS, shareState, shareUrl } from "@/lib/shareLink";
import { useSiteTimezone } from "../SiteSettingsProvider";

const T = bn.shareLink;
const btn = "min-h-11 rounded-full border border-line px-4 disabled:opacity-50";
const btnPrimary = "min-h-11 rounded-full bg-btn-bg px-5 font-semibold text-btn-tx disabled:opacity-50";
const input = "min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base";
type Opt = { id: string; title: string };
type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; links: ShareLinkWithId[]; posts: Opt[]; now: number };

/** event-handler/effect-এর "এখন" — render-purity lint এড়াতে আলাদা */
const nowMs = () => Date.now();

export function SharesView() {
  const tz = useSiteTimezone();
  const [st, setSt] = useState<Load>({ kind: "loading" });
  const [postId, setPostId] = useState("");
  const [days, setDays] = useState<number>(SHARE_DEFAULT_DAYS);
  const [token, setToken] = useState(() => generateShareToken());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [made, setMade] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Load> => {
    try {
      const [links, posts] = await Promise.all([getShareLinkRepo().then((r) => r.list()), getPostRepo().then((r) => r.list({ limit: 100 }))]);
      return {
        kind: "ready",
        links,
        now: nowMs(),
        posts: posts.filter((p) => p.status !== "trashed").map((p) => ({ id: p.id, title: p.title || bn.library.untitled })),
      };
    } catch {
      return { kind: "error" };
    }
  }, []);

  useEffect(() => {
    void load().then((s) => {
      setSt(s);
      const q = new URLSearchParams(window.location.search).get("post");
      if (q) setPostId(q);
    });
  }, [load]);

  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setSt(await load());
    } catch {
      setMsg({ kind: "err", text: T.failed });
    } finally {
      setBusy(false);
    }
  }

  const onCreate = () =>
    run(async () => {
      if (st.kind !== "ready") return;
      const title = st.posts.find((p) => p.id === postId)?.title ?? "";
      await (await getShareLinkRepo()).create({ token, postId, postTitle: title, days });
      setMade(shareUrl(window.location.origin, token));
      setToken(generateShareToken()); // পরের লিংকের জন্য নতুন token
    });

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg({ kind: "ok", text: T.copied });
    } catch {
      setMsg({ kind: "err", text: T.failed });
    }
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

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <label htmlFor="sh-post" className="mb-1 block text-sm text-muted">{T.pickPost}</label>
          <select id="sh-post" value={postId} onChange={(e) => setPostId(e.target.value)} className={input}>
            <option value="">{T.pickNone}</option>
            {st.posts.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sh-days" className="mb-1 block text-sm text-muted">{T.expiry}</label>
          <select id="sh-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className={input}>
            {SHARE_EXPIRY_DAYS.map((d) => (
              <option key={d} value={d}>{T.days(d)}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={onCreate} disabled={busy || !postId} className={btnPrimary}>
          {busy ? T.creating : T.create}
        </button>
        {made && (
          <div role="status" className="space-y-2 rounded-xl border border-line p-3">
            <p className="text-sm">{T.created}</p>
            <input readOnly value={made} onFocus={(e) => e.currentTarget.select()} aria-label={T.created} className={input} />
            <button type="button" className={btn} onClick={() => void copy(made)}>{T.copy}</button>
          </div>
        )}
        {msg && <p role={msg.kind === "err" ? "alert" : "status"} className={msg.kind === "err" ? "text-accent-text" : "text-muted"}>{msg.text}</p>}
      </section>

      <section>
        <h2 className="mb-2 font-serif text-xl font-bold">{T.list}</h2>
        {st.links.length === 0 ? (
          <p className="text-muted">{T.empty}</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {st.links.map((l) => {
              const s = shareState(l, st.now);
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.postTitle || bn.library.untitled}</p>
                    <p className="text-sm text-muted">
                      <span className="mr-2 rounded-full bg-line px-2 py-0.5">{T[s]}</span>
                      {T.until(formatDate(l.expiresAt, tz))}
                    </p>
                  </div>
                  {s === "active" && (
                    <button type="button" className={btn} disabled={busy} onClick={() => confirm(T.confirmRevoke) && void run(async () => (await getShareLinkRepo()).revoke(l.id))}>
                      {T.revoke}
                    </button>
                  )}
                  {s !== "active" && (
                    <button type="button" className={btn} disabled={busy} onClick={() => void run(async () => (await getShareLinkRepo()).remove(l.id))}>
                      {T.remove}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
