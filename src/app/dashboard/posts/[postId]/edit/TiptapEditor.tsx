"use client";

// Tiptap — শুধু এই route-এ lazy-load (next/dynamic, ssr:false)। Schema = allowlist (lib/editor-nodes.ts);
// strike/code/codeBlock বন্ধ, heading H2–H3, লিংক শুধু http/https/mailto।
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaWithId } from "@/data/mediaRepo";
import { getMediaRepo } from "@/data/mediaRepo.wire";
import { importMediaFromUrl, UploadError, uploadMedia } from "@/data/mediaUpload.client";
import { bn } from "@/i18n/bn";
import type { EditorPos } from "@/data/draftStore";
import { typewriterDelta } from "@/lib/comfort";
import { HEADING_LEVELS, MEDIA_ALT_MAX, NEW_IMAGE_LAYOUT, isSafeHref } from "@/lib/editor-nodes";
import type { DocNode } from "@/lib/editorDoc";
import { pasteToken, prepareImport } from "@/lib/pasteImages";
import { ImagePickerSheet } from "./ImagePickerSheet";
import { MediaImage } from "./mediaImageNode";
import { TextAlign } from "./textAlign";
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
  // কপি-করা ছবি/স্ক্রিনশট পেস্ট (ধাপ ক): handlePaste editor তৈরির আগে বাঁধা, তাই ref-এর মাধ্যমে
  const pasteImages = useRef<(files: File[]) => void>(() => undefined);
  // অন্য সাইট/ব্লগ থেকে কপি-করা লেখার ছবি (ধাপ খ): পেস্টে ছবির জায়গায় চিহ্ন বসে, আমদানি শেষে mediaImage দিয়ে বদলায়
  const importJob = useRef<{ tag: string; urls: string[]; alts: string[] } | null>(null);
  const runImport = useRef<() => void>(() => undefined);
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
      TextAlign,
    ],
    content: initialDoc,
    // spellcheck বন্ধ: বাংলা শব্দে ভুল লাল-দাগ ও "Add to dictionary" মেনু এড়াতে
    editorProps: {
      attributes: { class: "pm", lang: "bn", spellcheck: "false" },
      // শুধু বিশুদ্ধ ছবি-পেস্ট (ক্লিপবোর্ডে ছবির ফাইল আছে, লেখা নেই) আটকে আপলোড করি; লেখা/HTML থাকলে আগের মতোই (Word/ওয়েব কপিতে ছবির "রেন্ডার" থাকলেও লেখা নষ্ট হয় না)
      transformPastedHTML: (html) => {
        const r = prepareImport(html, Date.now().toString(36));
        if (r.urls.length > 0) importJob.current = { tag: r.tag, urls: r.urls, alts: r.alts };
        return r.html;
      },
      handlePaste: (_view, event) => {
        if (importJob.current) {
          setTimeout(() => runImport.current(), 0); // সাধারণ পেস্ট শেষ হওয়ার পর; লেখা আগের মতোই বসে
          return false;
        }
        const cd = event.clipboardData;
        if (!cd || cd.getData("text/plain").trim() || cd.getData("text/html").trim()) return false;
        const imgs = Array.from(cd.files).filter((f) => f.type.startsWith("image/"));
        if (imgs.length === 0) return false;
        event.preventDefault();
        pasteImages.current(imgs);
        return true;
      },
    },
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
    editor.chain().focus().insertContent({ type: "mediaImage", attrs: { mediaId: m.id, alt, ...NEW_IMAGE_LAYOUT } }).run();
  }

  // একটার পর একটা আপলোড (বিদ্যমান পথ: resize, EXIF মোছা); ব্যর্থ হলে থামে, আগেরগুলো বসে থাকে
  const [pasteMsg, setPasteMsg] = useState("");
  const pasteBusy = useRef(false);
  useEffect(() => {
    pasteImages.current = (files) => {
      if (!editor || pasteBusy.current) return;
      pasteBusy.current = true;
      setPasteMsg(bn.editor.image.uploading);
      void (async () => {
        let msg = "";
        try {
          const repo = await getMediaRepo();
          for (const f of files) insertImage(await uploadMedia(repo, f, "public"));
        } catch (err) {
          msg = bn.media.err[err instanceof UploadError ? err.code : "upload"];
        }
        pasteBusy.current = false;
        setPasteMsg(msg);
      })();
    };
  });

  useEffect(() => {
    runImport.current = () => {
      const job = importJob.current;
      importJob.current = null;
      if (!editor || !job) return;
      void (async () => {
        const total = job.urls.length;
        let failed = 0;
        let repo: Awaited<ReturnType<typeof getMediaRepo>> | null = null;
        try {
          repo = await getMediaRepo();
        } catch {
          failed = total;
        }
        // একটার পর একটা; কোনোটা ব্যর্থ হলে সেটার চিহ্ন মুছে বাকিগুলো চলে — লেখা কখনো হারায় না
        for (let i = 0; i < total; i++) {
          let media: MediaWithId | null = null;
          if (repo) {
            setPasteMsg(bn.editor.image.importing(i + 1, total));
            try {
              media = await importMediaFromUrl(repo, job.urls[i]!);
            } catch {
              media = null;
            }
            if (!media) failed++;
          }
          replaceToken(editor, pasteToken(job.tag, i), media, job.alts[i] ?? "");
        }
        setPasteMsg(failed > 0 ? bn.editor.image.importFailed(failed, total) : "");
      })();
    };
  });

  return (
    <>
      <EditorContent editor={editor} />
      {pasteMsg && (
        <p role="status" className="mt-2 text-sm text-muted">
          {pasteMsg}
        </p>
      )}
      {editor && <Toolbar editor={editor} onImage={() => setPicker(true)} />}
      {picker && <ImagePickerSheet onClose={closePicker} onPick={insertImage} />}
    </>
  );
}

/** doc-এ চিহ্নটি (সব জায়গায়) খুঁজে mediaImage দিয়ে বদলায়; media না থাকলে (ব্যর্থ) চিহ্ন মুছে দেয়। ব্যবহারকারী মুছে ফেললে কিছুই হয় না */
function replaceToken(ed: Editor, token: string, m: MediaWithId | null, alt: string) {
  const hits: { from: number; to: number }[] = [];
  ed.state.doc.descendants((n, pos) => {
    if (!n.isText || !n.text) return;
    let k = n.text.indexOf(token);
    while (k >= 0) {
      hits.push({ from: pos + k, to: pos + k + token.length });
      k = n.text.indexOf(token, k + token.length);
    }
  });
  const a = Array.from((m?.altText ?? alt).trim()).slice(0, MEDIA_ALT_MAX).join("");
  for (const h of hits.reverse()) {
    const c = ed.chain();
    if (m) c.insertContentAt(h, { type: "mediaImage", attrs: { mediaId: m.id, alt: a, ...NEW_IMAGE_LAYOUT } });
    else c.deleteRange(h);
    c.run();
  }
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
      alignLeft: ctx.editor.isActive({ textAlign: "left" }),
      alignCenter: ctx.editor.isActive({ textAlign: "center" }),
      alignRight: ctx.editor.isActive({ textAlign: "right" }),
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

  // একই বাটনে আবার চাপলে অ্যালাইনমেন্ট মুছে ডিফল্টে ফেরে (কবিতায় মাঝে, বাকিতে বামে)
  function setAlign(v: "left" | "center" | "right", active: boolean) {
    const value = active ? null : v;
    editor.chain().focus().updateAttributes("paragraph", { textAlign: value }).updateAttributes("heading", { textAlign: value }).run();
  }

  const items: { key: string; label: string; icon: string; on: boolean; run: () => void }[] = [
    { key: "b", label: bn.editor.bold, icon: "B", on: s.bold, run: () => editor.chain().focus().toggleBold().run() },
    { key: "i", label: bn.editor.italic, icon: "I", on: s.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { key: "u", label: bn.editor.underline, icon: "U", on: s.underline, run: () => editor.chain().focus().toggleUnderline().run() },
    { key: "h", label: bn.editor.heading, icon: "H", on: s.heading, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: "q", label: bn.editor.quote, icon: "❝", on: s.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { key: "ul", label: bn.editor.bullets, icon: "•", on: s.bullets, run: () => editor.chain().focus().toggleBulletList().run() },
    { key: "ol", label: bn.editor.numbers, icon: "1.", on: s.numbers, run: () => editor.chain().focus().toggleOrderedList().run() },
    { key: "al", label: bn.editor.alignLeft, icon: "⇤", on: s.alignLeft, run: () => setAlign("left", s.alignLeft) },
    { key: "ac", label: bn.editor.alignCenter, icon: "↔", on: s.alignCenter, run: () => setAlign("center", s.alignCenter) },
    { key: "ar", label: bn.editor.alignRight, icon: "⇥", on: s.alignRight, run: () => setAlign("right", s.alignRight) },
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
                role="menuitemcheckbox"
                aria-checked={it.on}
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
