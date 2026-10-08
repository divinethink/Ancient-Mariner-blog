"use client";

// পেজ-editor (Mockup §৭.১৬): Tiptap reuse; autosave শুধু লোকাল (IndexedDB), Firestore-এ লেখা [সেভ করুন]-এ ও তখন rebuild (Arch §১২ ঘ)।
// slug নতুন পেজে ইনপুট, তৈরির পর অপরিবর্তিত (doc-ID); reserved/অবৈধ slug lib/pages.ts-এ যাচাই। system পেজ মোছা যায় না।
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { localStore } from "@/data/localStore";
import { PageExistsError, type PageWithId } from "@/data/pageRepo";
import { getPageRepo } from "@/data/pageRepo.wire";
import { triggerSiteRebuild } from "@/data/rebuildClient";
import { bn } from "@/i18n/bn";
import { EMPTY_BODY, parseBody, serializeDoc, type DocNode } from "@/lib/editorDoc";
import { PAGE_STATUS, type PageStatus } from "@/lib/enums";
import { checkPageSlug, PAGE_TITLE_MAX, pagePath } from "@/lib/pages";
import { slugify } from "@/lib/slug";
import { ConfirmButton } from "../../ConfirmButton";

const TiptapEditor = dynamic(() => import("../../posts/[postId]/edit/TiptapEditor"), {
  ssr: false,
  loading: () => <div className="min-h-[40vh] animate-pulse rounded-xl bg-line" aria-hidden />,
});

const DEBOUNCE_MS = 1000;
const field = "w-full rounded-lg border border-line bg-surface px-3 text-base min-h-11";
type LocalCopy = { title: string; body: string; status: PageStatus; at: number };
type Phase = "loading" | "notfound" | "error" | "ready";
type Msg = { kind: "ok" | "err"; text: string } | null;

const localKey = (slug: string | undefined) => `pagedraft:${slug ?? "__new"}`;

export function PageEditor({ slug: slugProp }: { slug?: string }) {
  const t = bn.pages;
  const router = useRouter();
  const isNew = !slugProp;
  const [phase, setPhase] = useState<Phase>("loading");
  const [remote, setRemote] = useState<PageWithId | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState(slugProp ?? "");
  const [status, setStatus] = useState<PageStatus>("draft");
  const [initialDoc, setInitialDoc] = useState<DocNode>(parseBody(EMPTY_BODY));
  const [unsaved, setUnsaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const editorRef = useRef<Editor | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stateRef = useRef<{ title: string; status: PageStatus }>({ title: "", status: "draft" }); // handler/effect-এ হালনাগাদ (render-এ নয়)

  // লোড: রিমোট + লোকাল কপি; লোকাল নতুন হলে সেটাই (অসংরক্ষিত চিহ্নসহ)
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const page = slugProp ? await (await getPageRepo()).get(slugProp) : null;
        if (slugProp && !page) {
          if (!dead) setPhase("notfound");
          return;
        }
        const local = await localStore.get<LocalCopy>(localKey(slugProp)).catch(() => undefined);
        const useLocal = !!local && (!page || local.at > page.updatedAt.getTime());
        if (dead) return;
        setRemote(page);
        const ti = useLocal ? local.title : (page?.title ?? "");
        const st: PageStatus = useLocal ? local.status : (page?.status ?? "draft");
        stateRef.current = { title: ti, status: st };
        setTitle(ti);
        setStatus(st);
        setInitialDoc(parseBody(useLocal ? local.body : (page?.body ?? EMPTY_BODY)));
        setUnsaved(useLocal);
        setPhase("ready");
      } catch {
        if (!dead) setPhase("error");
      }
    })();
    return () => {
      dead = true;
    };
  }, [slugProp]);

  const persistLocal = useCallback(async () => {
    const ed = editorRef.current;
    if (!ed) return;
    const { title: ti, status: st } = stateRef.current;
    await localStore
      .set(localKey(slugProp), { title: ti, body: serializeDoc(ed.getJSON()), status: st, at: Date.now() } satisfies LocalCopy)
      .catch(() => undefined);
  }, [slugProp]);

  const touch = useCallback(() => {
    setUnsaved(true);
    setMsg(null);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void persistLocal(), DEBOUNCE_MS);
  }, [persistLocal]);

  useEffect(() => () => clearTimeout(timerRef.current), []);
  const onEditor = useCallback((e: Editor | null) => {
    editorRef.current = e;
  }, []);

  async function onSave() {
    const ed = editorRef.current;
    if (!ed || busy) return;
    const finalSlug = isNew ? slug.trim() : (slugProp as string);
    if (isNew) {
      const bad = checkPageSlug(finalSlug);
      if (bad !== "ok") {
        setMsg({ kind: "err", text: bad === "empty" ? t.slugEmpty : bad === "reserved" ? t.slugReserved : t.slugBad });
        return;
      }
    }
    setBusy(true);
    setMsg(null);
    try {
      const repo = await getPageRepo();
      const body = serializeDoc(ed.getJSON());
      const wasPublished = remote?.status === "published";
      // create double-tap/retry-নিরাপদ: বিদ্যমান হলে PageExistsError, দ্বিতীয় লেখা হয় না
      const saved = isNew
        ? await repo.create({ slug: finalSlug, title, body, status })
        : await repo.update(finalSlug, { title, body, status });
      await localStore.delete(localKey(slugProp)).catch(() => undefined);
      clearTimeout(timerRef.current);
      setRemote(saved);
      setUnsaved(false);
      // পাবলিকে প্রভাব পড়লেই rebuild (এখন/আগে published); draft→draft-এ নয়
      if (saved.status === "published" || wasPublished) {
        const ok = await triggerSiteRebuild();
        setMsg({ kind: ok ? "ok" : "err", text: ok ? `${t.saved} ${t.siteUpdating}` : t.rebuildFailed });
      } else setMsg({ kind: "ok", text: t.saved });
      if (isNew) router.replace(`/dashboard/pages/edit?slug=${encodeURIComponent(saved.slug)}`);
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof PageExistsError ? t.slugTaken : t.saveFailed });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!remote || busy) return;
    setBusy(true);
    try {
      await (await getPageRepo()).remove(remote.slug);
      await localStore.delete(localKey(remote.slug)).catch(() => undefined);
      if (remote.status === "published") await triggerSiteRebuild();
      router.push("/dashboard/pages");
    } catch {
      setMsg({ kind: "err", text: t.deleteFailed });
      setBusy(false);
    }
  }

  if (phase === "loading") return <p className="text-muted">{t.loading}</p>;
  if (phase === "notfound" || phase === "error") {
    return (
      <>
        <Link href="/dashboard/pages" className="mb-3 inline-flex min-h-11 items-center text-accent-text">
          {t.back}
        </Link>
        <p role="alert">{phase === "notfound" ? t.notFound : t.loadFailed}</p>
      </>
    );
  }
  return (
    <div className="pb-24">
      <Link href="/dashboard/pages" className="mb-3 inline-flex min-h-11 items-center text-accent-text">
        {t.back}
      </Link>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm text-muted">{t.titleLabel}</span>
          <input
            value={title}
            maxLength={PAGE_TITLE_MAX}
            onChange={(e) => {
              setTitle(e.target.value);
              stateRef.current = { ...stateRef.current, title: e.target.value };
              if (isNew && slug === "") setSlug(slugify(e.target.value)); // শুধু প্রস্তাব; owner বদলাতে পারে
              touch();
            }}
            className={field}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">{t.slugLabel}</span>
          <input
            value={slug}
            readOnly={!isNew}
            onChange={(e) => setSlug(e.target.value)}
            className={`${field} ${isNew ? "" : "opacity-70"}`}
            aria-describedby="slug-hint"
          />
          <span id="slug-hint" className="mt-1 block text-xs text-muted">
            {isNew ? `${t.slugHint} → ${pagePath(slug || "…")}` : `${pagePath(slug)} — ${t.slugHint}`}
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">{t.statusLabel}</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as PageStatus);
              stateRef.current = { ...stateRef.current, status: e.target.value as PageStatus };
              touch();
            }}
            className={field}
          >
            {PAGE_STATUS.map((s) => (
              <option key={s} value={s}>
                {s === "published" ? t.published : t.draft}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4">
        <TiptapEditor
          initialDoc={initialDoc}
          onContentChange={touch}
          onCaretMove={() => undefined}
          onBlur={() => void persistLocal()}
          onEditor={onEditor}
        />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSave()}
          className="min-h-11 rounded-full bg-btn-bg px-6 font-semibold text-btn-tx disabled:opacity-50"
        >
          {busy ? t.saving : t.save}
        </button>
        {remote?.status === "published" && (
          <a href={pagePath(remote.slug)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-accent-text underline">
            {t.viewLive}
          </a>
        )}
        {remote && !remote.system && (
          <ConfirmButton
            label={t.delete}
            question={t.deleteQuestion}
            disabled={busy}
            onConfirm={() => void onDelete()}
            className="min-h-11 rounded-full border border-line px-4 disabled:opacity-50"
          />
        )}
      </div>
      {unsaved && <p className="mt-2 text-sm text-muted">{t.unsaved}</p>}
      {msg && (
        <p role={msg.kind === "err" ? "alert" : "status"} className={`mt-2 text-sm ${msg.kind === "err" ? "text-red-700" : ""}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
