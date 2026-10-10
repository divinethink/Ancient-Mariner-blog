"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadLocalIndex, syncSearchIndex, verifySearchEntry } from "@/data/searchIndex.wire";
import { bn } from "@/i18n/bn";
import { formatDateTime } from "@/lib/datetime";
import { CONTENT_TYPE } from "@/lib/enums";
import {
  facets,
  highlight,
  prepare,
  search,
  SEARCH_LIMIT,
  type SearchEntry,
  type SearchHit,
  type Seg,
} from "@/lib/search";
import { useSiteTimezone } from "../SiteSettingsProvider";

const sel = "mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base";
const STATUSES = ["draft", "published", "archived"] as const;
const STATUS_LABEL: Record<string, string> = {
  draft: bn.library.draft,
  published: bn.library.published,
  archived: bn.library.archived,
};

function Marked({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((s, i) =>
        s.hit ? (
          <mark
            key={i}
            className="rounded bg-[color-mix(in_srgb,var(--accent)_30%,transparent)] px-0.5 text-inherit"
          >
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

type Sync = "idle" | "syncing" | "failed";

/** পূর্ণ-লেখা খোঁজ (private, offline-সক্ষম; P8b)। index = ডিভাইসের IndexedDB; খুললেই পুরনো index দিয়ে চলে, পেছনে delta-sync। */
export function SearchView({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const tz = useSiteTimezone();
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [syncedAt, setSyncedAt] = useState(0);
  const [sync, setSync] = useState<Sync>("idle");
  const [q, setQ] = useState(initialQuery);
  const [dq, setDq] = useState(initialQuery);
  const [type, setType] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null); // প্রসারিত আইডিয়া/নোটের key
  const [gone, setGone] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // লোকাল index আগে (নেট ছাড়াই); তারপর পেছনে delta-sync ও আবার লোকাল পড়া। `attempt` বদলালে আবার (retry)।
  useEffect(() => {
    let dead = false;
    const read = () =>
      loadLocalIndex().then(
        (l) => {
          if (dead) return;
          setEntries(l.entries);
          setSyncedAt(l.syncedAt);
        },
        () => {
          if (!dead) setEntries((e) => e ?? []);
        },
      );
    read().then(() => {
      if (dead || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
      setSync("syncing");
      return syncSearchIndex()
        .then(
          () => {
            if (!dead) setSync("idle");
          },
          () => {
            if (!dead) setSync("failed");
          },
        )
        .then(read);
    });
    return () => {
      dead = true;
    };
  }, [attempt]);

  useEffect(() => {
    const id = setTimeout(() => setDq(q), 200);
    return () => clearTimeout(id);
  }, [q]);

  // URL-এ শব্দ রাখা (back/refresh-এ ফেরে); re-render/navigation ছাড়াই
  useEffect(() => {
    const u = new URL(location.href);
    if (dq.trim()) u.searchParams.set("q", dq.trim());
    else u.searchParams.delete("q");
    history.replaceState(history.state, "", u);
  }, [dq]);

  const prepared = useMemo(() => prepare(entries ?? []), [entries]);
  const fct = useMemo(() => facets(entries ?? [], CONTENT_TYPE), [entries]);
  const result = useMemo(
    () => search(prepared, dq, { type, categoryId, status }, SEARCH_LIMIT),
    [prepared, dq, type, categoryId, status],
  );
  const lit = useMemo(
    () => result.hits.map((h) => ({ h, hl: highlight(h.entry, dq) })),
    [result, dq],
  );

  const kindLabel = (e: SearchEntry) =>
    e.kind === "idea"
      ? bn.search.kindIdea
      : e.kind === "note"
        ? bn.search.kindNote
        : (bn.org.types[e.contentType ?? "post"] ?? bn.org.types.post);

  async function openHit(h: SearchHit) {
    const e = h.entry;
    setGone(null);
    const ok = await verifySearchEntry(e); // স্থায়ীভাবে মোছা লেখা index-এ থাকতে পারে
    if (!alive.current) return;
    if (ok === false) {
      setEntries((xs) => (xs ?? []).filter((x) => x.key !== e.key));
      setGone(e.key);
      return;
    }
    if (e.kind === "post") router.push(`/dashboard/posts/${e.id}/edit`);
    else setOpen((k) => (k === e.key ? null : e.key));
  }

  const building = entries !== null && entries.length === 0 && syncedAt === 0 && sync === "syncing";
  const hasQuery = dq.trim() !== "";

  return (
    <div>
      <label className="block text-sm text-muted">
        {bn.search.label}
        <input
          type="search"
          lang="bn"
          autoFocus
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          value={q}
          placeholder={bn.search.placeholder}
          onChange={(e) => setQ(e.target.value)}
          className="mt-1 min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-base text-text"
        />
      </label>

      <div
        role="group"
        aria-label={bn.search.filters}
        className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <label className="text-sm text-muted">
          {bn.search.filterType}
          <select value={type} onChange={(e) => setType(e.target.value)} className={sel}>
            <option value="">{bn.search.all}</option>
            {fct.types.map((t) => (
              <option key={t} value={t}>
                {bn.org.types[t] ?? t}
              </option>
            ))}
            <option value="idea">{bn.search.typeIdea}</option>
            <option value="note">{bn.search.typeNote}</option>
          </select>
        </label>
        <label className="text-sm text-muted">
          {bn.search.filterCategory}
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={sel}
          >
            <option value="">{bn.search.all}</option>
            {fct.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          {bn.search.filterStatus}
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
            <option value="">{bn.search.all}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p role="status" aria-live="polite" className="mt-4 text-sm text-muted">
        {building
          ? bn.search.building
          : sync === "syncing"
            ? bn.search.updating
            : hasQuery && entries
              ? result.total === 0
                ? bn.search.none
                : bn.search.count(result.hits.length, result.total)
              : syncedAt
                ? bn.search.synced(formatDateTime(syncedAt, tz))
                : bn.search.neverSynced}
      </p>
      {sync === "failed" && (
        <p role="alert" className="mt-1 text-sm text-muted">
          {bn.search.syncFailed}{" "}
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="min-h-11 text-accent-text underline"
          >
            {bn.search.retry}
          </button>
        </p>
      )}
      {gone && (
        <p role="alert" className="mt-1 text-sm text-muted">
          {bn.search.gone}
        </p>
      )}
      {!hasQuery && <p className="mt-2 text-sm text-muted">{bn.search.hint}</p>}

      <ul className="mt-3 space-y-3">
        {lit.map(({ h, hl }) => {
          const e = h.entry;
          const expanded = open === e.key;
          return (
            <li key={e.key} className="rounded-2xl border border-line bg-surface p-4">
              <button
                type="button"
                onClick={() => void openHit(h)}
                aria-expanded={e.kind === "post" ? undefined : expanded}
                className="block min-h-11 w-full text-left"
              >
                <span className="block font-serif text-lg font-semibold">
                  {e.title ? <Marked segs={hl.title} /> : bn.search.untitled}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {[
                    kindLabel(e),
                    e.categoryName,
                    e.kind === "post" ? STATUS_LABEL[e.status ?? ""] : undefined,
                    formatDateTime(e.updatedAt, tz),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {hl.snippet.length > 0 && !expanded && (
                  <span className="mt-2 block break-words text-sm leading-relaxed">
                    <Marked segs={hl.snippet} />
                  </span>
                )}
              </button>
              {expanded && (
                <div className="mt-2 border-t border-line pt-3">
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {e.text}
                  </p>
                  <div className="mt-3 flex gap-4 text-sm">
                    <button
                      type="button"
                      onClick={() => setOpen(null)}
                      className="min-h-11 text-muted underline"
                    >
                      {bn.search.collapse}
                    </button>
                    <Link
                      href={e.kind === "idea" ? "/dashboard/ideas" : "/dashboard/inbox"}
                      className="flex min-h-11 items-center text-accent-text underline"
                    >
                      {e.kind === "idea" ? bn.search.goIdeas : bn.search.goInbox}
                    </Link>
                  </div>
                </div>
              )}
              {!expanded && e.kind !== "post" && (
                <p className="mt-1 text-xs text-muted">{bn.search.expand} ›</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
