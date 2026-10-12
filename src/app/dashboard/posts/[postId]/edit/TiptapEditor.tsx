"use client";

// Tiptap — শুধু এই route-এ lazy-load (next/dynamic, ssr:false)। Schema = allowlist (lib/editor-nodes.ts);
// strike/code/codeBlock বন্ধ, heading H2–H3, লিংক শুধু http/https/mailto।
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaWithId } from "@/data/mediaRepo";
import { bn } from "@/i18n/bn";
import type { EditorPos } from "@/data/draftStore";
import { typewriterDelta } from "@/lib/comfort";
import { HEADING_LEVELS, MEDIA_ALT_MAX, isSafeHref } from "@/lib/editor-nodes";
import type { DocNode } from "@/lib/editorDoc";
import { ImagePickerSheet } from "./ImagePickerSheet";
import { MediaImage } from "./mediaImageNode";
import { ParaFocus } from "./paraFocus";
import { useKeyboardInset } from "./useKeyboardInset";

type Props = {
  initialDoc: DocNode;
  pos?: EditorPos;
  onContentChange: () => void;
  onCaretMove: () => void;
  onBlur: () => void;
  onEditor: (e: Editor | null) => void;
};

export default function TiptapEditor({
  initialDoc,
  pos,
  onContentChange,
  onCaretMove,
  onBlur,
  onEditor,
}: Props) {
  const initialPos = useRef(pos);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [...HEADING_LEVELS] },
        strike: false,
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: false, isAllowedUri: (url: string) => isSafeHref(url) },
      }),
      ParaFocus,
      MediaImage,
    ],
    content: initialDoc,
    // spellcheck বন্ধ: বাংলা শব্দে ভুল লাল-দাগ ও "Add to dictionary" মেনু এড়াতে
    editorProps: { attributes: { class: "pm", lang: "bn", spellcheck: "false" } },
    onUpdate: ({ editor: ed }) => {
      onContentChange();
      // Typewriter scroll (P7b-১): টাইপের পর caret-কে স্থির উচ্চতায় রাখে; শুধু টাইপে, ট্যাপে নয়
      if (document.documentElement.dataset.tw !== "1") return;
      requestAnimationFrame(() => {
        try {
          const top = ed.view.coordsAtPos(ed.state.selection.head).top;
          const d = typewriterDelta(top, window.visualViewport?.height ?? window.innerHeight);
          if (d !== 0) window.scrollBy(0, d);
        } catch {
          // editor আর নেই — উপেক্ষা
        }
      });
    },
    onSelectionUpdate: () => onCaretMove(),
    onBlur: () => onBlur(),
  });

  // ইচ্ছাকৃতভাবে cleanup-এ null করা হয় না: unmount-এর flush শেষ লেখাটুকু এই ref থেকেই পড়ে (parent-এর cleanup child-এর পরে চলে)
  useEffect(() => {
    onEditor(editor);
  }, [editor, onEditor]);

  // শেষ caret/scroll অবস্থানে ফেরা (শুধু প্রথমবার; keyboard খোলে না)
  useEffect(() => {
    const p = initialPos.current;
    if (!editor || !p) return;
    try {
      const max = editor.state.doc.content.size;
      editor.commands.setTextSelection({ from: Math.min(p.from, max), to: Math.min(p.to, max) });
    } catch {
      // অবৈধ অবস্থান — উপেক্ষা
    }
    requestAnimationFrame(() => window.scrollTo(0, p.scrollY));
  }, [editor]);

  const [picker, setPicker] = useState(false);
  const closePicker = useCallback(() => setPicker(false), []);

  // বাছা ছবি কার্সারের জায়গায় বসে (blur-এর পরও ProseMirror-এর শেষ selection থাকে); doc-এ শুধু mediaId + alt
  function insertImage(m: MediaWithId) {
    if (!editor) return;
    const alt = Array.from((m.altText ?? "").trim()).slice(0, MEDIA_ALT_MAX).join("");
    editor.chain().focus().insertContent({ type: "mediaImage", attrs: { mediaId: m.id, alt } }).run();
  }

  return (
    <>
      <EditorContent editor={editor} />
      {editor && <Toolbar editor={editor} onImage={() => setPicker(true)} />}
      {picker && <ImagePickerSheet onClose={closePicker} onPick={insertImage} />}
    </>
  );
}

function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const inset = useKeyboardInset();
  const [more, setMore] = useState(false);
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [more]);
  const s = useEditorState({
    editor,
    selector: (ctx) => ({
      bold: ctx.editor.isActive("bold"),
      italic: ctx.editor.isActive("italic"),
      underline: ctx.editor.isActive("underline"),
      heading: ctx.editor.isActive("heading"),
      quote: ctx.editor.isActive("blockquote"),
      bullets: ctx.editor.isActive("bulletList"),
      numbers: ctx.editor.isActive("orderedList"),
      link: ctx.editor.isActive("link"),
    }),
  });

  function toggleLink() {
    if (s.link) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const url = window.prompt(bn.editor.linkPrompt, "https://");
    if (!url) return;
    if (!isSafeHref(url)) {
      window.alert(bn.editor.linkInvalid);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  const items: { key: string; label: string; icon: string; on: boolean; run: () => void }[] = [
    { key: "b", label: bn.editor.bold, icon: "B", on: s.bold, run: () => editor.chain().focus().toggleBold().run() },
    { key: "i", label: bn.editor.italic, icon: "I", on: s.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { key: "u", label: bn.editor.underline, icon: "U", on: s.underline, run: () => editor.chain().focus().toggleUnderline().run() },
    { key: "h", label: bn.editor.heading, icon: "H", on: s.heading, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: "q", label: bn.editor.quote, icon: "❝", on: s.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { key: "ul", label: bn.editor.bullets, icon: "•", on: s.bullets, run: () => editor.chain().focus().toggleBulletList().run() },
    { key: "ol", label: bn.editor.numbers, icon: "1.", on: s.numbers, run: () => editor.chain().focus().toggleOrderedList().run() },
    { key: "a", label: s.link ? bn.editor.unlink : bn.editor.link, icon: "🔗", on: s.link, run: toggleLink },
    { key: "img", label: bn.editor.image.add, icon: "🖼️", on: false, run: onImage },
    { key: "undo", label: bn.editor.undo, icon: "↶", on: false, run: () => editor.chain().focus().undo().run() },
    { key: "redo", label: bn.editor.redo, icon: "↷", on: false, run: () => editor.chain().focus().redo().run() },
  ];

  // মোবাইলে ৭টির বেশি বাটন আঁটে না ⇒ ৬টি মূল টুল সরাসরি, বাকি (ক্রমিক তালিকা, লিংক, undo/redo) "⋯" পপওভারে; অনুভূমিক স্ক্রল নেই
  const PRIMARY = ["b", "i", "u", "h", "q", "ul"];
  const primary = items.filter((it) => PRIMARY.includes(it.key));
  const overflow = items.filter((it) => !PRIMARY.includes(it.key));
  const overflowOn = overflow.some((it) => it.on);
  const btn = "min-h-11 min-w-11 flex-1 rounded-lg text-base font-semibold md:flex-none";

  return (
    <div
      role="toolbar"
      aria-label={bn.editor.toolbar}
      style={{ bottom: inset }}
      className="chrome fixed inset-x-0 z-30 flex gap-1 border-t border-line bg-surface p-1.5 md:justify-center lg:left-[var(--nav-w,0px)] lg:right-[var(--insp-w,0px)]"
    >
      {primary.map((it) => (
        <button
          key={it.key}
          type="button"
          aria-label={it.label}
          aria-pressed={it.on}
          // মাউস/টাচে selection হারানো এড়াতে focus সরতে দেওয়া হয় না
          onMouseDown={(e) => e.preventDefault()}
          onClick={it.run}
          className={`${btn} ${it.on ? "bg-btn-bg text-btn-tx" : "text-text"}`}
        >
          {it.icon}
        </button>
      ))}
      <button
        type="button"
        aria-label={bn.editor.moreTools}
        aria-haspopup="menu"
        aria-expanded={more}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setMore((o) => !o)}
        className={`${btn} text-xl ${more || overflowOn ? "bg-line" : "text-text"}`}
      >
        ⋯
      </button>
      {more && (
        <>
          {/* বাইরে ট্যাপে বন্ধ; -z-10 = টুলবারের stacking-context-এর ভেতরে, বাটনের নিচে */}
          <button
            type="button"
            aria-label={bn.editor.moreTools}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setMore(false)}
            className="fixed inset-0 -z-10 cursor-default"
          />
          <div
            role="menu"
            className="absolute bottom-full right-1.5 mb-1 flex min-w-48 flex-col rounded-xl border border-line bg-surface p-1 shadow-lg"
          >
            {overflow.map((it) => (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                aria-pressed={it.on}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  it.run();
                  setMore(false);
                }}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-left ${it.on ? "bg-btn-bg text-btn-tx" : ""}`}
              >
                <span aria-hidden className="w-6 text-center font-semibold">
                  {it.icon}
                </span>
                <span>{it.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
