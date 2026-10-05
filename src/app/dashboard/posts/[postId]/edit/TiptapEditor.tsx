"use client";

// Tiptap — শুধু এই route-এ lazy-load (next/dynamic, ssr:false)। Schema = allowlist (lib/editor-nodes.ts);
// strike/code/codeBlock বন্ধ, heading H2–H3, লিংক শুধু http/https/mailto।
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { bn } from "@/i18n/bn";
import type { EditorPos } from "@/data/draftStore";
import { HEADING_LEVELS, isSafeHref } from "@/lib/editor-nodes";
import type { DocNode } from "@/lib/editorDoc";
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
    ],
    content: initialDoc,
    editorProps: { attributes: { class: "pm", lang: "bn" } },
    onUpdate: () => onContentChange(),
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

  return (
    <>
      <EditorContent editor={editor} />
      {editor && <Toolbar editor={editor} />}
    </>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const inset = useKeyboardInset();
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
    { key: "undo", label: bn.editor.undo, icon: "↶", on: false, run: () => editor.chain().focus().undo().run() },
    { key: "redo", label: bn.editor.redo, icon: "↷", on: false, run: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div
      role="toolbar"
      aria-label={bn.editor.toolbar}
      style={{ bottom: inset }}
      className="fixed inset-x-0 z-30 flex gap-1 overflow-x-auto border-t border-line bg-surface p-1.5 md:justify-center"
    >
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          aria-label={it.label}
          aria-pressed={it.on}
          // মাউস/টাচে selection হারানো এড়াতে focus সরতে দেওয়া হয় না
          onMouseDown={(e) => e.preventDefault()}
          onClick={it.run}
          className={`min-h-11 min-w-11 shrink-0 rounded-lg text-base font-semibold ${
            it.on ? "bg-btn-bg text-btn-tx" : "text-text"
          }`}
        >
          {it.icon}
        </button>
      ))}
    </div>
  );
}
