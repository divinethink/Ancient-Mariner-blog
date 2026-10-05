"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { draftStore, type EditorPos } from "@/data/draftStore";
import { bn } from "@/i18n/bn";
import { countWords, docToText, makeExcerpt, sanitizeDoc, type DocNode } from "@/lib/editorDoc";
import { PublishPanel } from "./PublishPanel";
import { useRemoteSync, type PubInfo } from "./useRemoteSync";

// Tiptap ভারী — শুধু এই route-এ, client-এ lazy
const TiptapEditor = dynamic(() => import("./TiptapEditor"), {
  ssr: false,
  loading: () => <div className="min-h-[55vh] animate-pulse rounded-xl bg-line" aria-hidden />,
});

const DEBOUNCE_MS = 1000; // Arch §১২ autosave-ক: ~১s debounce, IndexedDB লোকাল সেভ

export type Loaded = {
  title: string;
  doc: DocNode;
  createdAt: number;
  pos?: EditorPos;
  excerpt: string;
  /** প্যানেলে হাতে লেখা (autosave বদলাবে না) */
  excerptManual: boolean;
  pub: PubInfo;
};
type SaveState = "idle" | "saving" | "saved" | "failed";

export function EditorSurface({ postId, data }: { postId: string; data: Loaded }) {
  const [title, setTitle] = useState(data.title);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [words, setWords] = useState(() => countWords(docToText(data.doc)));
  const [excerpt, setExcerpt] = useState(data.excerpt);
  const [panelOpen, setPanelOpen] = useState(false);
  const { status, pub, setPub, engine, edited, blur } = useRemoteSync(postId, data.pub);

  const editorRef = useRef<Editor | null>(null);
  const titleRef = useRef(data.title);
  const createdAtRef = useRef(data.createdAt);
  const touchedRef = useRef(false); // শুধু বদলালে লোকাল ড্রাফট লেখা — খুলেই ছেড়ে দিলে কিছু তৈরি হয় না
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const excerptRef = useRef({ value: data.excerpt, manual: data.excerptManual });
  const blockedRef = useRef(false); // বাতিল/সার্ভারের-লেখা-আনার পর reload-এর আগে লোকাল ড্রাফট আর লেখা নয়

  const onEditor = useCallback((e: Editor | null) => {
    editorRef.current = e;
  }, []);

  const persist = useCallback(async () => {
    const ed = editorRef.current;
    if (!ed || blockedRef.current) return;
    try {
      const pos: EditorPos = {
        from: ed.state.selection.from,
        to: ed.state.selection.to,
        scrollY: window.scrollY,
      };
      if (touchedRef.current) {
        const doc = sanitizeDoc(ed.getJSON());
        const text = docToText(doc);
        const wc = countWords(text);
        if (!excerptRef.current.manual) excerptRef.current.value = makeExcerpt(text);
        await draftStore.saveDraft({
          id: postId,
          title: titleRef.current,
          body: JSON.stringify(doc),
          excerpt: excerptRef.current.value,
          excerptManual: excerptRef.current.manual,
          wordCount: wc,
          createdAt: createdAtRef.current,
          updatedAt: Date.now(),
          dirty: true,
        });
        setWords(wc);
        setSaveState("saved");
        edited(); // লোকাল সেভের পর Firestore sync-এর সময়সূচি
      }
      await draftStore.savePos(postId, pos);
    } catch {
      setSaveState("failed");
    }
  }, [postId, edited]);

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    void persist();
  }, [persist]);

  /** লোকাল সেভ শেষ হওয়া পর্যন্ত অপেক্ষা (panel/blur sync-এর আগে ড্রাফট যেন সর্বশেষ হয়) */
  const flushAsync = useCallback(() => {
    clearTimeout(timerRef.current);
    return persist();
  }, [persist]);

  const onBlur = useCallback(() => {
    void flushAsync().then(blur);
  }, [flushAsync, blur]);

  const schedule = useCallback(
    (touch: boolean) => {
      if (touch) {
        touchedRef.current = true;
        setSaveState("saving");
      }
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void persist(), DEBOUNCE_MS);
    },
    [persist],
  );

  // ট্যাব লুকালে/পেজ ছাড়লে/unmount-এ সাথে সাথে লোকাল সেভ
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  /** প্যানেল থেকে সারাংশ বদল: খালি = আবার স্বয়ংক্রিয় */
  const onExcerpt = useCallback(
    (v: string) => {
      const ed = editorRef.current;
      excerptRef.current =
        v.trim() === ""
          ? { value: ed ? makeExcerpt(docToText(sanitizeDoc(ed.getJSON()))) : "", manual: false }
          : { value: v, manual: true };
      setExcerpt(excerptRef.current.value);
      schedule(true);
    },
    [schedule],
  );

  /** লোকাল ড্রাফট মুছে পেজ রিলোড — রিমোটের লেখা আসে (বাতিল/সার্ভারের-লেখা-আনা) */
  const reloadFromRemote = useCallback(async () => {
    blockedRef.current = true;
    clearTimeout(timerRef.current);
    await draftStore.deleteDraft(postId).catch(() => undefined);
    location.reload();
  }, [postId]);

  const statusText =
    status === "syncing"
      ? bn.editor.syncing
      : status === "synced"
        ? bn.editor.synced
        : saveState === "saving"
          ? bn.editor.saving
          : saveState === "saved"
            ? bn.editor.savedLocal
            : "";

  return (
    <div>
      <header className="sticky top-0 z-20 -mx-6 mb-4 flex min-h-14 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur">
        <Link
          href="/dashboard"
          aria-label={bn.editor.back}
          onClick={flush}
          className="flex size-11 items-center justify-center text-xl"
        >
          ←
        </Link>
        <span role="status" aria-live="polite" className="flex-1 text-sm text-muted">
          {statusText}
          {saveState === "failed" && <span className="text-accent-text"> {bn.editor.saveFailed}</span>}
          {status === "failed" && (
            <button
              type="button"
              onClick={() => void engine?.syncNow().catch(() => undefined)}
              className="min-h-11 text-accent-text underline"
            >
              {bn.editor.syncRetry}
            </button>
          )}
          {pub.status === "published" && pub.hasUnpublished && (
            <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-xs">{bn.editor.unpublished}</span>
          )}
        </span>
        <span className="hidden text-sm text-muted sm:inline">
          {words} {bn.editor.words}
        </span>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="min-h-11 rounded-full bg-btn-bg px-4 text-sm font-semibold text-btn-tx"
        >
          {bn.editor.publish}
        </button>
      </header>

      {status === "failed" && (
        <p role="status" className="mb-3 text-sm text-muted">
          {bn.editor.syncFailed}
        </p>
      )}
      {status === "trashed" && (
        <p role="alert" className="mb-3 rounded-xl border border-line bg-surface p-3 text-sm">
          {bn.editor.trashedNotice}
        </p>
      )}
      {status === "conflict" && (
        <div role="alert" className="mb-4 rounded-xl border border-line bg-surface p-3 text-sm">
          <p className="mb-2">{bn.editor.conflictTitle}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void engine?.keepMine().catch(() => undefined)}
              className="min-h-11 rounded-full bg-btn-bg px-4 text-btn-tx"
            >
              {bn.editor.keepMine}
            </button>
            <button
              type="button"
              onClick={() => confirm(bn.editor.confirmUseRemote) && void reloadFromRemote()}
              className="min-h-11 rounded-full border border-line px-4"
            >
              {bn.editor.useRemote}
            </button>
          </div>
        </div>
      )}

      <textarea
        value={title}
        rows={1}
        placeholder={bn.editor.titlePlaceholder}
        aria-label={bn.editor.titlePlaceholder}
        lang="bn"
        onChange={(e) => {
          setTitle(e.target.value);
          titleRef.current = e.target.value;
          schedule(true);
        }}
        onBlur={onBlur}
        className="mb-3 block w-full resize-none bg-transparent font-serif text-3xl font-bold leading-snug outline-none field-sizing-content"
      />

      <TiptapEditor
        initialDoc={data.doc}
        pos={data.pos}
        onContentChange={() => schedule(true)}
        onCaretMove={() => schedule(false)}
        onBlur={onBlur}
        onEditor={onEditor}
      />
      <div className="h-24" aria-hidden />
      {panelOpen && (
      <PublishPanel
        onClose={() => setPanelOpen(false)}
        flushLocal={flushAsync}
        postId={postId}
        engine={engine}
        status={status}
        excerpt={excerpt}
        onExcerpt={onExcerpt}
        onPub={setPub}
        onDiscarded={reloadFromRemote}
      />
      )}
    </div>
  );
}
