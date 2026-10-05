// পোস্টের সংগঠন-ফিল্ড (ধরন/ক্যাটাগরি/ট্যাগ/সিরিজ) — Publish panel-এর pure যুক্তি (SDK/UI-মুক্ত; Checklist P3a-২খ)।
// panel-এর state ⇄ `PostPatch`-সামঞ্জস্য patch: শুধু যা বদলেছে তা, ক্যাটাগরি/ট্যাগের id+নাম সবসময় জোড়ায় (Zod refine মানতে)।
import type { ContentType } from "./enums";

export const MAX_TAGS = 20; // data/postRepo-র MAX_TAGS_PER_POST-এর সাথে মিলতে হবে (লঙ্ঘনে patch Zod-এ আটকায়)

export type OrgTag = { id: string; name: string };
export type OrgState = {
  contentType: ContentType;
  categoryId: string | null;
  categoryName: string | null;
  tags: OrgTag[];
  seriesId: string | null;
  seriesOrder: number | null;
};
export type OrgPatch = {
  contentType?: ContentType;
  categoryId?: string | null;
  categoryName?: string | null;
  tagIds?: string[];
  tagNames?: string[];
  seriesId?: string | null;
  seriesOrder?: number | null;
};

type PostLike = {
  contentType: ContentType;
  categoryId?: string;
  categoryName?: string;
  tagIds: readonly string[];
  tagNames: readonly string[];
  seriesId?: string;
  seriesOrder?: number;
};

export function orgFromPost(p: PostLike): OrgState {
  return {
    contentType: p.contentType,
    categoryId: p.categoryId ?? null,
    categoryName: p.categoryId ? (p.categoryName ?? "") : null,
    tags: p.tagIds.map((id, i) => ({ id, name: p.tagNames[i] ?? "" })),
    seriesId: p.seriesId ?? null,
    seriesOrder: p.seriesId ? (p.seriesOrder ?? null) : null,
  };
}

/** cur → next-এ যা বদলেছে শুধু তাই; কিছু না বদলালে `{}` (অকারণ write নয়) */
export function orgPatch(cur: OrgState, next: OrgState): OrgPatch {
  const out: OrgPatch = {};
  if (next.contentType !== cur.contentType) out.contentType = next.contentType;
  if (next.categoryId !== cur.categoryId) {
    out.categoryId = next.categoryId;
    out.categoryName = next.categoryId ? (next.categoryName ?? "") : null;
  }
  const same =
    cur.tags.length === next.tags.length && cur.tags.every((t, i) => t.id === next.tags[i].id);
  if (!same) {
    out.tagIds = next.tags.map((t) => t.id);
    out.tagNames = next.tags.map((t) => t.name);
  }
  const seriesId = next.seriesId;
  const order = seriesId ? next.seriesOrder : null;
  if (seriesId !== cur.seriesId || order !== cur.seriesOrder) {
    out.seriesId = seriesId;
    out.seriesOrder = order;
  }
  return out;
}

export type AddTagResult =
  | { ok: true; tags: OrgTag[]; created: OrgTag | null }
  | { ok: false; reason: "empty" | "long" | "dup" | "limit" };

/**
 * নাম থেকে ট্যাগ যোগ: বিদ্যমান ট্যাগের নামের সাথে মিললে (বড়-ছোট হাত নির্বিশেষে) সেটাই; নইলে নতুন id (`created`) —
 * সেটা সেভের সময় বানানো হয় (id আগে থেকে ঠিক ⇒ retry-তে duplicate নয়)।
 */
export function addTag(
  tags: readonly OrgTag[],
  raw: string,
  known: readonly OrgTag[],
  makeId: () => string,
  maxLen: number,
): AddTagResult {
  const name = raw.trim().replace(/^#+/, "").trim();
  if (!name) return { ok: false, reason: "empty" };
  if (name.length > maxLen) return { ok: false, reason: "long" };
  const lower = name.toLowerCase();
  const hit = known.find((k) => k.name.toLowerCase() === lower);
  const already = tags.some((t) => (hit ? t.id === hit.id : t.name.toLowerCase() === lower));
  if (already) return { ok: false, reason: "dup" };
  if (tags.length >= MAX_TAGS) return { ok: false, reason: "limit" };
  const tag = hit ? { id: hit.id, name: hit.name } : { id: makeId(), name };
  return { ok: true, tags: [...tags, tag], created: hit ? null : tag };
}

/** পর্ব-নম্বর ইনপুট: খালি → null (বৈধ); অঋণাত্মক পূর্ণসংখ্যা → সংখ্যা; নইলে `"invalid"` */
export function parseSeriesOrder(input: string): number | null | "invalid" {
  const s = input.trim();
  if (s === "") return null;
  if (!/^\d{1,5}$/.test(s)) return "invalid";
  return Number(s);
}
