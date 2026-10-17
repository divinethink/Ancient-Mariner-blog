"use client";

// এডিটরের `mediaImage` node (P6-খ): doc-এ শুধু {mediaId, alt, caption?} — raw URL কখনো নয় (lib/editor-nodes.ts allowlist)।
// প্রিভিউ: mediaId → media মেটা (data layer) → cldUrl; মোছা/অবৈধ হলে স্থানধারক (node নিজে অক্ষত থাকে)।
import { Node, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";
import type { MediaWithId } from "@/data/mediaRepo";
import { getMediaRepo } from "@/data/mediaRepo.wire";
import { bn } from "@/i18n/bn";
import { cldUrl, cloudFromUrl } from "@/lib/cloudinary";
import { Segmented } from "@/components/ui/Segmented";
import {
  IMAGE_ALIGNS,
  IMAGE_SIZES,
  isImageAlign,
  isImageSize,
  isSafeMediaId,
  MEDIA_ALT_MAX,
  MEDIA_CAPTION_MAX,
  type ImageAlign,
  type ImageSize,
} from "@/lib/editor-nodes";

// একই ছবি বহুবার থাকলেও একবারই আনা; ব্যর্থ হলে cache থেকে সরে যায় (পরের বার আবার চেষ্টা)
const cache = new Map<string, Promise<MediaWithId | null>>();
function loadMedia(id: string): Promise<MediaWithId | null> {
  let p = cache.get(id);
  if (!p) {
    p = getMediaRepo()
      .then((r) => r.get(id))
      .catch(() => {
        cache.delete(id);
        return null;
      });
    cache.set(id, p);
  }
  return p;
}

type View = { id: string; m: MediaWithId | null };

function MediaImageView({ node, selected, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const id = typeof node.attrs.mediaId === "string" ? node.attrs.mediaId : "";
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    if (!id) return;
    let dead = false;
    void loadMedia(id).then((m) => {
      if (!dead) setView({ id, m });
    });
    return () => {
      dead = true;
    };
  }, [id]);

  const m = view?.id === id ? view.m : undefined; // undefined = লোড হচ্ছে, null = পাওয়া যায়নি
  const cloud = m ? cloudFromUrl(m.cloudinaryUrl) : null;
  const src = m && cloud ? cldUrl(cloud, m.cloudinaryPublicId, { w: 800 }) : null;
  const alt = (typeof node.attrs.alt === "string" && node.attrs.alt) || m?.altText || "";
  const caption = typeof node.attrs.caption === "string" ? node.attrs.caption : "";
  const ownAlt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const field = "min-h-11 w-full rounded-lg border border-line bg-transparent px-3 text-sm";
  // attr না থাকা (পুরনো ছবি) = পুরো-প্রস্থ ও মাঝে; পাবলিকের CSS-এর একই নিয়ম
  const size: ImageSize = isImageSize(node.attrs.size) ? node.attrs.size : "full";
  const align: ImageAlign = isImageAlign(node.attrs.align) ? node.attrs.align : "center";

  return (
    <NodeViewWrapper
      as="figure"
      contentEditable={false}
      data-drag-handle
      data-size={isImageSize(node.attrs.size) ? node.attrs.size : undefined}
      data-align={isImageAlign(node.attrs.align) ? node.attrs.align : undefined}
      className={`reading-figure rounded-xl ${selected ? "outline outline-2 outline-offset-2 outline-accent" : ""}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" decoding="async" draggable={false} />
      ) : (
        <div className="flex min-h-32 items-center justify-center rounded-xl bg-line px-3 text-center text-sm text-muted">
          <span aria-hidden className="mr-2 text-xl">
            🖼️
          </span>
          {m === undefined ? bn.editor.image.loading : bn.editor.image.missing}
        </div>
      )}
      {editor.isEditable && (
        // বাটনে চাপলে editor-এর focus/selection সরতে দেওয়া হয় না (টুলবারের মতোই) — নইলে ব্রাউজার selection বদলে পেজ নিচে স্ক্রল করে; input-এ আগের মতোই
        <div
          className="mt-2 space-y-2 font-sans"
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) e.preventDefault();
          }}
        >
          <Segmented
            label={bn.editor.image.sizeLabel}
            showLabel
            compact
            value={size}
            options={IMAGE_SIZES.map((v) => ({ value: v, label: bn.editor.image.sizes[v] }))}
            onChange={(v) => updateAttributes({ size: v })}
          />
          <Segmented
            label={bn.editor.image.alignLabel}
            showLabel
            compact
            value={align}
            options={IMAGE_ALIGNS.map((v) => ({ value: v, label: bn.editor.image.aligns[v] }))}
            onChange={(v) => updateAttributes({ align: v })}
          />
          <input
            type="text"
            aria-label={bn.editor.image.altLabel}
            placeholder={bn.editor.image.altPlaceholder}
            maxLength={MEDIA_ALT_MAX}
            value={ownAlt}
            onChange={(e) => updateAttributes({ alt: e.target.value })}
            className={field}
          />
          <input
            type="text"
            aria-label={bn.editor.image.captionLabel}
            placeholder={bn.editor.image.captionPlaceholder}
            maxLength={MEDIA_CAPTION_MAX}
            value={caption}
            onChange={(e) => updateAttributes({ caption: e.target.value || null })}
            className={field}
          />
          <button
            type="button"
            onClick={() => deleteNode()}
            className="min-h-11 rounded-full border border-line px-4 text-sm text-accent-text"
          >
            🗑️ {bn.editor.image.remove}
          </button>
        </div>
      )}
    </NodeViewWrapper>
  );
}

export const MediaImage = Node.create({
  name: "mediaImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      mediaId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-media-id"),
        renderHTML: (a) => (a.mediaId ? { "data-media-id": a.mediaId } : {}),
      },
      alt: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-alt") ?? "",
        renderHTML: (a) => (a.alt ? { "data-alt": a.alt } : {}),
      },
      caption: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-caption"),
        renderHTML: (a) => (a.caption ? { "data-caption": a.caption } : {}),
      },
      // null = পুরনো ছবি (পুরো-প্রস্থ); শুধু বৈধ মান (সেভের সময় sanitizeDoc-ও যাচাই করে)
      size: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute("data-size");
          return isImageSize(v) ? v : null;
        },
        renderHTML: (a) => (isImageSize(a.size) ? { "data-size": a.size } : {}),
      },
      align: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute("data-align");
          return isImageAlign(v) ? v : null;
        },
        renderHTML: (a) => (isImageAlign(a.align) ? { "data-align": a.align } : {}),
      },
    };
  },

  // বাইরে থেকে পেস্ট: শুধু বৈধ mediaId-সহ figure নেওয়া হয় (সেভের সময় sanitizeDoc আবারও যাচাই করে)
  parseHTML() {
    return [
      {
        tag: "figure[data-media-id]",
        getAttrs: (el) => (isSafeMediaId((el as HTMLElement).getAttribute("data-media-id")) ? null : false),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", HTMLAttributes];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MediaImageView);
  },
});
