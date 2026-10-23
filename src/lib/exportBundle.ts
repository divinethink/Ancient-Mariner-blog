// P13b: সব লেখা এক ফাইলে (Markdown/HTML) — pure, SDK/UI-মুক্ত। শুধু read; ক্যাটাগরি অনুযায়ী সাজানো।
// ডিফল্ট = শুধু published+public (ব্যক্তিগত লেখা ভুলে ফাইলে না যাওয়ার জন্য); 'all' = ট্র্যাশ বাদে সব। HTML-এ সব টেক্সট escape, লিংক শুধু http/https/mailto (docHtml)।
import { dayKey, formatDate } from "./datetime";
import { bodyToHtml, escapeHtml } from "./docHtml";
import { parseBody } from "./editorDoc";
import { mdEscape, serializeDocShifted } from "./export/serialize";
import type { BackupDoc, BackupSource } from "./backup";

export type ExportMode = "published" | "all";
export type ExportPost = { id: string; title: string; body: string; category: string; whenMs: number | null };

export const UNCATEGORIZED = "অন্যান্য";
export const EXPORT_PAGE_SIZE = 100;

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function toMs(v: unknown): number | null {
  let d: Date | null = null;
  if (v instanceof Date) d = v;
  else if (typeof v === "object" && v !== null && typeof (v as { toDate?: unknown }).toDate === "function") {
    d = (v as { toDate: () => Date }).toDate();
  } else if (typeof v === "string" || typeof v === "number") d = new Date(v);
  const t = d?.getTime();
  return t === undefined || Number.isNaN(t) ? null : t;
}

/** trashed সবসময় বাদ; 'published' মোডে শুধু published+public */
export function selectPosts(docs: BackupDoc[], mode: ExportMode): ExportPost[] {
  const out: ExportPost[] = [];
  for (const { id, data } of docs) {
    const status = str(data.status);
    if (status === "trashed") continue;
    if (mode === "published" && !(status === "published" && str(data.visibility) === "public")) continue;
    out.push({
      id,
      title: str(data.title).trim(),
      body: str(data.body),
      category: str(data.categoryName).trim() || UNCATEGORIZED,
      whenMs: toMs(data.publishedAt) ?? toMs(data.createdAt),
    });
  }
  return out;
}

/** ঐচ্ছিক দিন-সীমা (সহ, সাইট-timezone-এর দিন-key); 'বছরের বই'-এর জন্য। তারিখহীন লেখা সীমা দিলে বাদ */
export type DayRange = { from?: string | undefined; to?: string | undefined };
export const hasRange = (r: DayRange | undefined): r is DayRange => Boolean(r && (r.from || r.to));

export function filterByRange(posts: ExportPost[], range: DayRange | undefined, timeZone: string): ExportPost[] {
  if (!hasRange(range)) return posts;
  return posts.filter((p) => {
    if (p.whenMs === null) return false;
    const d = dayKey(p.whenMs, timeZone);
    return (!range.from || d >= range.from) && (!range.to || d <= range.to);
  });
}

export type ExportGroup = { category: string; posts: ExportPost[] };

/** ক্যাটাগরি বাংলা-ক্রমে ('অন্যান্য' সবশেষে); ভেতরে তারিখ পুরনো→নতুন (তারিখহীন শেষে), তারপর শিরোনাম, id */
export function groupByCategory(posts: ExportPost[]): ExportGroup[] {
  const map = new Map<string, ExportPost[]>();
  for (const p of posts) map.set(p.category, [...(map.get(p.category) ?? []), p]);
  const cmp = (a: ExportPost, b: ExportPost) =>
    (a.whenMs ?? Infinity) - (b.whenMs ?? Infinity) || a.title.localeCompare(b.title, "bn") || a.id.localeCompare(b.id);
  return [...map.entries()]
    .map(([category, ps]) => ({ category, posts: [...ps].sort(cmp) }))
    .sort((a, b) =>
      a.category === UNCATEGORIZED ? 1 : b.category === UNCATEGORIZED ? -1 : a.category.localeCompare(b.category, "bn"),
    );
}

const postTitle = (p: ExportPost) => p.title || "(শিরোনামহীন)";
const dateOf = (p: ExportPost, tz: string) => (p.whenMs === null ? "" : formatDate(p.whenMs, tz));

export type BundleMeta = { heading: string; exportedAt: Date; timeZone: string; mode: ExportMode; range?: DayRange | undefined };
export const bundleNote = (m: BundleMeta, n: number) =>
  `${formatDate(m.exportedAt, m.timeZone)} · ${n}টি লেখা · ${m.mode === "all" ? "সব লেখা (ট্র্যাশ বাদে)" : "শুধু প্রকাশিত"}${
    hasRange(m.range) ? ` · পরিসর: ${m.range.from ?? "শুরু"} – ${m.range.to ?? "আজ"}` : ""
  }`;

export function buildMarkdown(posts: ExportPost[], meta: BundleMeta): string {
  const lines = [`# ${mdEscape(meta.heading)}`, "", `*${bundleNote(meta, posts.length)}*`, ""];
  for (const g of groupByCategory(posts)) {
    lines.push(`## ${mdEscape(g.category)}`, "");
    for (const p of g.posts) {
      lines.push(`### ${mdEscape(postTitle(p))}`, "");
      const d = dateOf(p, meta.timeZone);
      if (d) lines.push(`*${d}*`, "");
      const body = serializeDocShifted(parseBody(p.body), 2).trim();
      if (body) lines.push(body, "");
    }
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

const CSS =
  ":root{color-scheme:light dark}body{margin:0;font:18px/1.9 'Noto Serif Bengali',Georgia,serif;background:#faf9f5;color:#1f1e1d}" +
  "@media(prefers-color-scheme:dark){body{background:#1c1b19;color:#ece8df}a{color:#ee9b7d}}" +
  "main{max-width:720px;margin:0 auto;padding:24px 20px 64px}h1,h2,h3{line-height:1.4}h2{margin-top:2.2em;border-bottom:1px solid #8884;padding-bottom:.2em}" +
  "article{margin-top:2em}.meta{opacity:.7;font-size:.9em}.body h2,.body h3{font-size:1.1em}.img-ph{opacity:.7;font-style:italic}blockquote{margin:1em 0;padding-left:16px;border-left:3px solid #c96442}a{color:#a94e2f}" +
  "nav ul{padding-left:1.2em}nav li{margin:.2em 0}";

export function buildHtml(posts: ExportPost[], meta: BundleMeta): string {
  const groups = groupByCategory(posts);
  const toc = groups
    .map(
      (g, gi) =>
        `<li>${escapeHtml(g.category)}<ul>${g.posts
          .map((p, pi) => `<li><a href="#p${gi}-${pi}">${escapeHtml(postTitle(p))}</a></li>`)
          .join("")}</ul></li>`,
    )
    .join("");
  const sections = groups
    .map(
      (g, gi) =>
        `<section><h2>${escapeHtml(g.category)}</h2>${g.posts
          .map((p, pi) => {
            const d = dateOf(p, meta.timeZone);
            return `<article id="p${gi}-${pi}"><h3>${escapeHtml(postTitle(p))}</h3>${
              d ? `<p class="meta">${escapeHtml(d)}</p>` : ""
            }<div class="body">${bodyToHtml(p.body, { imagePlaceholders: true })}</div></article>`;
          })
          .join("")}</section>`,
    )
    .join("");
  const h = escapeHtml(meta.heading);
  return (
    `<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${h}</title><style>${CSS}</style></head><body><main><h1>${h}</h1><p class="meta">${escapeHtml(bundleNote(meta, posts.length))}</p>` +
    `<nav aria-label="সূচি"><ul>${toc}</ul></nav>${sections}</main></body></html>\n`
  );
}

export function exportFileName(now: Date, ext: "md" | "html" | "docx"): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `ancient-mariner-lekha-${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}.${ext}`;
}

/** `posts` পাতায় পাতায় পুরোটা (limit-এ কাটা নয়); abort হলে throw — আংশিক ফল কখনো দেওয়া হয় না */
export async function readAllPosts(
  source: BackupSource,
  opts: { signal?: AbortSignal; pageSize?: number; onProgress?: (n: number) => void } = {},
): Promise<BackupDoc[]> {
  const size = opts.pageSize ?? EXPORT_PAGE_SIZE;
  const all: BackupDoc[] = [];
  let after: string | undefined;
  for (;;) {
    if (opts.signal?.aborted) throw new Error("এক্সপোর্ট বাতিল");
    const page = await source.readPage("posts", after, size);
    all.push(...page);
    opts.onProgress?.(all.length);
    if (page.length < size) return all;
    after = page[page.length - 1].id;
  }
}
