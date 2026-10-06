// WordPress ইমপোর্ট চালানো (P3c-খ): slug-owner পড়া → planWrites → ক্যাটাগরি/ট্যাগ নাম মিলিয়ে reuse/তৈরি → chunked লেখা।
// সব নির্ভরতা inject করা (test-যোগ্য; bulkRun-এর ছাঁচ)। idempotent: আবার চালালে আগের লেখা skip, ব্যর্থ অংশই শুধু আবার চেষ্টা।
import type { ImportRow } from "@/data/importPosts.client";
import {
  chunkWrites,
  importTermId,
  normName,
  planWrites,
  wantedTerms,
  type ImportDraft,
} from "@/lib/import/commit";
import type { ImportPlan } from "@/lib/import/plan";

export type TermKind = "categories" | "tags";

export type ImportDeps = {
  owners(): Promise<Map<string, string>>;
  terms(kind: TermKind): Promise<{ id: string; name: string }[]>;
  /** নির্ধারিত `id`-তে idempotent তৈরি */
  createTerm(kind: TermKind, id: string, name: string): Promise<{ id: string }>;
  commit(rows: ImportRow[]): Promise<void>;
  wait(ms: number): Promise<void>;
};

export type ImportResult = {
  imported: number;
  already: number;
  invalid: number;
  oversize: string[];
  /** লেখা যায়নি (আবার চেষ্টা করলে শুধু এগুলো চলবে) */
  failed: number;
  failedTitles: string[];
  termsCreated: { categories: number; tags: number };
};

const ATTEMPTS = 3;

async function ensureTerms(deps: ImportDeps, kind: TermKind, names: string[]): Promise<{ map: Map<string, string>; created: number }> {
  const map = new Map<string, string>();
  for (const t of await deps.terms(kind)) map.set(normName(t.name), t.id);
  let created = 0;
  for (const name of names) {
    const k = normName(name);
    if (map.has(k)) continue;
    map.set(k, (await deps.createTerm(kind, importTermId(kind, name), name)).id);
    created++;
  }
  return { map, created };
}

export async function runImport(
  deps: ImportDeps,
  plan: ImportPlan,
  site: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const wp = planWrites(plan, site, await deps.owners());
  const res: ImportResult = {
    imported: 0,
    already: wp.already,
    invalid: wp.invalid,
    oversize: wp.oversize,
    failed: 0,
    failedTitles: [],
    termsCreated: { categories: 0, tags: 0 },
  };
  const total = wp.writes.length;
  if (total === 0) return res;

  // term তৈরি ব্যর্থ হলে এখানেই থামে (কোনো লেখা লেখা হয়নি; আবার চালালে নাম মিলিয়ে reuse)
  const want = wantedTerms(wp.writes);
  const cats = await ensureTerms(deps, "categories", want.categories);
  const tags = await ensureTerms(deps, "tags", want.tags);
  res.termsCreated = { categories: cats.created, tags: tags.created };
  const toRow = (d: ImportDraft): ImportRow => ({
    draft: d,
    categoryId: d.categoryName ? cats.map.get(normName(d.categoryName)) : undefined,
    tagIds: d.tagNames.map((n) => tags.map.get(normName(n)) as string),
  });

  let done = 0;
  for (const part of chunkWrites(wp.writes)) {
    let pending = part;
    for (let a = 1; a <= ATTEMPTS && pending.length > 0; a++) {
      try {
        await deps.commit(pending.map(toRow));
        pending = [];
      } catch {
        // সফল-হয়েও-জবাব-হারানো হতে পারে: lock দেখে যেগুলো লেখা হয়ে গেছে সেগুলো বাদ
        try {
          const written = new Set((await deps.owners()).values());
          pending = pending.filter((d) => !written.has(d.id));
        } catch {
          /* পড়া গেল না — সবটাই আবার চেষ্টা */
        }
        if (pending.length > 0 && a < ATTEMPTS) await deps.wait(300 * 2 ** (a - 1));
      }
    }
    res.imported += part.length - pending.length;
    res.failed += pending.length;
    res.failedTitles.push(...pending.map((d) => d.title));
    done += part.length;
    onProgress?.(done, total);
  }
  return res;
}
