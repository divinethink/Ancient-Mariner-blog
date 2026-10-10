// মন্তব্যের pure যুক্তি (P11b-১; Arch §৬, §১৪) — SDK/UI-মুক্ত। guest-only, শুধু নাম + plain-text; email সংগ্রহ নেই।
// owner-সিদ্ধান্ত ২০২৬-১০-১০: মডারেশন নেই (সরাসরি প্রকাশ)। তাই সুরক্ষা = Turnstile + D1 rate-limit + আকার-সীমা + অতিরিক্ত-লিংক হলে স্বয়ংক্রিয় 'spam' (লুকানো)।
import { isValidPostId } from "./id";

export const NAME_MAX = 60;
export const CONTENT_MAX = 2000;
/** এর বেশি লিংক থাকলে মন্তব্য পাবলিকে যায় না (status='spam') — স্প্যামের সবচেয়ে সাধারণ চিহ্ন */
export const MAX_LINKS = 2;
/** একজন ভিজিটর (দৈনিক salted hash) প্রতি ঘণ্টায়/দিনে সর্বোচ্চ এত মন্তব্য */
export const MAX_COMMENTS_PER_HOUR = 5;
export const MAX_COMMENTS_PER_DAY = 20;

const ID_RE = /^[A-Za-z0-9]{20}$/;
// eslint-disable-next-line no-control-regex
const CTRL = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]", "g");

export type CommentPayload = {
  /** client-বানানো ২০-অক্ষরের ID — একই ID-তে দ্বিতীয় জমা = duplicate (double-submit/retry নিরাপদ) */
  commentId: string;
  postId: string;
  parentCommentId?: string;
  authorName: string;
  content: string;
  turnstileToken: string;
};

/** NFC + অদৃশ্য/নিয়ন্ত্রণ অক্ষর ও bidi-override বাদ + CRLF→LF; শুধু plain-text (HTML নয় — render-এ React escape করে) */
export function cleanText(raw: string): string {
  return raw.normalize("NFC").replace(/\r\n?/g, "\n").replace(CTRL, "");
}

export const cleanName = (raw: string): string => cleanText(raw).replace(/\s+/g, " ").trim();
export const cleanContent = (raw: string): string => cleanText(raw).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/** অবৈধ হলে null (কারণ ফেরানো হয় না — অনুসন্ধান-সুবিধা নয়; UI নিজে আগে যাচাই করে) */
export function parseCommentPayload(raw: unknown): CommentPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : null);
  const commentId = str("commentId");
  const postId = str("postId");
  const name = str("authorName");
  const content = str("content");
  const token = str("turnstileToken");
  if (!commentId || !ID_RE.test(commentId) || !postId || !isValidPostId(postId)) return null;
  if (name === null || content === null || !token || token.length > 2048) return null;
  if (name.length > NAME_MAX * 4 || content.length > CONTENT_MAX * 4) return null; // পরিষ্কারের আগে মোটা আকার-সীমা
  const authorName = cleanName(name);
  const body = cleanContent(content);
  if (authorName.length < 1 || authorName.length > NAME_MAX) return null;
  if (body.length < 1 || body.length > CONTENT_MAX) return null;
  let parentCommentId: string | undefined;
  if (o.parentCommentId !== undefined && o.parentCommentId !== null && o.parentCommentId !== "") {
    if (typeof o.parentCommentId !== "string" || !ID_RE.test(o.parentCommentId) || o.parentCommentId === commentId) return null;
    parentCommentId = o.parentCommentId;
  }
  return { commentId, postId, parentCommentId, authorName, content: body, turnstileToken: token };
}

const LINK = /(?:https?:\/\/|www\.)\S+/gi;
export const countLinks = (s: string): number => s.match(LINK)?.length ?? 0;
/** নাম বা লেখায় অতিরিক্ত লিংক (নাম-এ কোনো লিংকই নয়) */
export const looksSpammy = (authorName: string, content: string): boolean => countLinks(authorName) > 0 || countLinks(content) > MAX_LINKS;

/** D1 `rateLimits` key: উইন্ডো key-র ভেতরেই (PK একক), `windowStart` = দিন (Cron cleanup-এর জন্য) */
export const commentHourKey = (h: string, hour: string): string => `ch:${h}:${hour}`;
export const commentDayKey = (h: string, day: string): string => `cd:${h}:${day}`;
