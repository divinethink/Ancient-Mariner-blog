// দিনলিপির ছবি (pure): ছবি = লেখার body-তে শেষে বসা `mediaImage` node (নতুন ফিল্ড/schema নেই) — পাবলিক রেন্ডার/ব্যাকআপ/এক্সপোর্ট আগের পথেই চলে।
import { collectMediaIds, parseBody, type DocNode } from "./editorDoc";
import { MEDIA_ALT_MAX } from "./editor-nodes";

/** এক দিনলিপিতে সর্বোচ্চ ছবি */
export const MAX_DIARY_PHOTOS = 6;

export type PhotoRef = { id: string; alt?: string };

const clipAlt = (s: string | undefined): string => Array.from((s ?? "").trim()).slice(0, MEDIA_ALT_MAX).join("");

/** doc-এর শেষে ছবিগুলো (ক্রম বজায়, ডুপ্লিকেট বাদ, সীমা `MAX_DIARY_PHOTOS`)। মূল doc বদলায় না */
export function withPhotos(doc: DocNode, photos: readonly PhotoRef[]): DocNode {
  const seen = new Set<string>();
  const nodes: DocNode[] = [];
  for (const p of photos) {
    if (seen.has(p.id) || nodes.length >= MAX_DIARY_PHOTOS) continue;
    seen.add(p.id);
    nodes.push({ type: "mediaImage", attrs: { mediaId: p.id, alt: clipAlt(p.alt), size: "full", align: "center" } });
  }
  return nodes.length === 0 ? doc : { ...doc, content: [...(doc.content ?? []), ...nodes] };
}

/** body (JSON string) → ছবির media-id (ক্রম বজায়) */
export const photoIdsOf = (body: string): string[] => collectMediaIds(parseBody(body));
