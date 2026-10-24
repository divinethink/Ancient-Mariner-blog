// Production যাচাইয়ের pure যুক্তি (SDK/UI-মুক্ত): live Firestore rules বনাম repo-র rules, নামহীন (anonymous) প্রবেশ-probe, backup-তাজাভাব।
// শুধু সিদ্ধান্ত দেয় — কিছু লেখে/মোছে না। I/O আছে `scripts/verify-prod.ts`-এ (read-only)।
import { BACKUP_STALE_DAYS } from "./backupPolicy";

export type CheckStatus = "pass" | "fail" | "info" | "error";

/** `//` মন্তব্য বাদ + সব whitespace এক-স্পেস — অর্থহীন পার্থক্য (মন্তব্য/ফাঁকা) উপেক্ষা */
export function normalizeRules(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const topMatches = (src: string): string[] => {
  const out = new Set<string>();
  for (const m of normalizeRules(src).matchAll(/match\s+\/([A-Za-z0-9_]+)\/\{/g)) out.add(m[1]);
  return [...out].sort();
};

export type RulesDrift = {
  same: boolean;
  /** repo-তে আছে, live-এ নেই (⇒ ওই collection live-এ default-deny; feature ভাঙা) */
  missingInLive: string[];
  /** live-এ আছে, repo-তে নেই (⇒ অজানা/হাতে-বসানো rule) */
  extraInLive: string[];
};

export function diffRules(live: string, expected: string): RulesDrift {
  const l = topMatches(live);
  const e = topMatches(expected);
  return {
    same: normalizeRules(live) === normalizeRules(expected),
    missingInLive: e.filter((x) => !l.includes(x)),
    extraInLive: l.filter((x) => !e.includes(x)),
  };
}

export type Probe = {
  name: string;
  collection: string;
  /** equality filter-গুলো (AND); না থাকলে filter-ছাড়া query */
  where?: Record<string, string>;
  /** deny = 403 প্রত্যাশিত; allow = 200 প্রত্যাশিত; info = শুধু অবস্থা জানানো */
  expect: "deny" | "allow" | "info";
};

const deny = (collection: string, where?: Record<string, string>): Probe => ({
  name: `${collection}${
    where
      ? ` [${Object.entries(where)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}]`
      : ""
  }`,
  collection,
  where,
  expect: "deny",
});

/** নামহীন client-এর প্রবেশ: ব্যক্তিগত/draft/owner-only সবই বন্ধ; শুধু প্রকাশিত-পাবলিক খোলা */
export const PROBES: readonly Probe[] = [
  {
    name: "posts [published, public] (পাবলিক — খোলা থাকার কথা)",
    collection: "posts",
    where: { status: "published", visibility: "public" },
    expect: "allow",
  },
  { name: "siteSettings (পাবলিক)", collection: "siteSettings", expect: "allow" },
  {
    name: "comments [approved] (পাবলিক)",
    collection: "comments",
    where: { status: "approved" },
    expect: "allow",
  },
  {
    name: "posts [published, unlisted] — 200 মানে unlisted লেখা যে-কেউ তালিকাভুক্ত করতে পারে",
    collection: "posts",
    where: { status: "published", visibility: "unlisted" },
    expect: "info",
  },
  deny("posts", { status: "draft" }),
  deny("posts", { status: "published", visibility: "private" }),
  deny("posts", { status: "trashed" }),
  deny("pages", { status: "draft" }),
  deny("comments", { status: "spam" }),
  deny("books", { visibility: "private" }),
  deny("media", { visibility: "private" }),
  deny("writingProjects", { status: "draft" }),
  deny("chapters", { status: "draft" }),
  ...[
    "drafts",
    "ideas",
    "notes",
    "letters",
    "quotes",
    "trips",
    "specialDays",
    "revisions",
    "backups",
    "shareLinks",
    "slugs",
    "bookmarks",
    "highlights",
    "templates",
    "zz_probe_default_deny",
  ].map((c) => deny(c)),
];

/** Firestore REST `:runQuery` body (limit ১ — সর্বনিম্ন read) */
export function probeBody(p: Probe): { structuredQuery: Record<string, unknown> } {
  const filters = Object.entries(p.where ?? {}).map(([field, value]) => ({
    fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } },
  }));
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: p.collection }],
    limit: 1,
  };
  if (filters.length === 1) structuredQuery.where = filters[0];
  else if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: "AND", filters } };
  return { structuredQuery };
}

/** HTTP status → ফল. 403 = rules-এ বন্ধ; 200 = খোলা; বাকি (৪০০/৫xx/নেটওয়ার্ক) = যাচাই করা যায়নি ⇒ error (পাস নয়) */
export function evaluateProbe(p: Probe, status: number): CheckStatus {
  const denied = status === 403;
  const allowed = status === 200;
  if (!denied && !allowed) return "error";
  if (p.expect === "info") return "info";
  if (p.expect === "deny") return denied ? "pass" : "fail";
  return allowed ? "pass" : "fail";
}

export type FreshnessResult = { status: CheckStatus; detail: string };

/** সর্বশেষ সম্পূর্ণ backup-এর বয়স (দিন); `BACKUP_STALE_DAYS`-এর বেশি বা একটাও না থাকলে fail */
export function backupFreshness(completed: readonly Date[], now: Date): FreshnessResult {
  if (completed.length === 0) return { status: "fail", detail: "একটাও সম্পূর্ণ backup-রেকর্ড নেই" };
  const last = completed.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));
  const ageDays = (now.getTime() - last.getTime()) / 86_400_000;
  const text = `সর্বশেষ ${last.toISOString()} (${ageDays.toFixed(1)} দিন আগে)`;
  return { status: ageDays > BACKUP_STALE_DAYS ? "fail" : "pass", detail: text };
}
