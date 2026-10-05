"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { draftStore, type EditorPos } from "@/data/draftStore";
import { bn } from "@/i18n/bn";
import { countWords, docToText, makeExcerpt, sanitizeDoc, type DocNode } from "@/lib/editorDoc";

// Tiptap ভারী — শুধু এই route-এ, client-এ lazy
const TiptapEditor = dynamic(() => import("./TiptapEditor"), {
  ssr: false,
  loading: () => <div className="min-h-[55vh] animate-pulse rounded-xl bg-line" aria-hidden />,
});

const DEBOUNCE_MS = 1000; // Arch §১২ autosave-ক: ~১s debounce, IndexedDB লোকাল সেভ

export type Loaded = { title: string; doc: DocNode; createdAt: number; pos?: EditorPos };
type SaveState = "idle" | "saving" | "saved" | "failed";

export function EditorSurface({ postId, data }: { postId: string; data: Loaded }) {
  const [title, setTitle] = useState(data.title);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [words, setWords] = useState(() => countWords(docToText(data.doc)));

  const editorRef = useRef<Editor | null>(null);
  const titleRef = useRef(data.title);
  const createdAtRef = useRef(data.createdAt);
  const touchedRef = useRef(false); // শুধু বদলালে লোকাল ড্রাফট লেখা — খুলেই ছেড়ে দিলে কিছু তৈরি হয় না
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onEditor = useCallback((e: Editor | null) => {
    editorRef.current = e;
  }, []);

  const persist = useCallback(async () => {
    const ed = editorRef.current;
    if (!ed) return;
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
        await draftStore.saveDraft({
          id: postId,
          title: titleRef.current,
          body: JSON.stringify(doc),
          excerpt: makeExcerpt(text),
          wordCount: wc,
          createdAt: createdAtRef.current,
          updatedAt: Date.now(),
          dirty: true,
        });
        setWords(wc);
        setSaveState("saved");
      }
      await draftStore.savePos(postId, pos);
    } catch {
      setSaveState("failed");
    }
  }, [postId]);

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    void persist();
  }, [persist]);

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
          {saveState === "saving" && bn.editor.saving}
          {saveState === "saved" && bn.editor.savedLocal}
          {saveState === "failed" && <span className="text-accent-text">{bn.editor.saveFailed}</span>}
        </span>
        <span className="text-sm text-muted">
          {words} {bn.editor.words}
        </span>
      </header>

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
        onBlur={flush}
        className="mb-3 block w-full resize-none bg-transparent font-serif text-3xl font-bold leading-snug outline-none field-sizing-content"
      />

      <TiptapEditor
        initialDoc={data.doc}
        pos={data.pos}
        onContentChange={() => schedule(true)}
        onCaretMove={() => schedule(false)}
        onBlur={flush}
        onEditor={onEditor}
      />
      <div className="h-24" aria-hidden />
    </div>
  );
}
