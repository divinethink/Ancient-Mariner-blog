"use client";

// পাবলিক খোঁজ (P10a-২): `/search-index.json` শুধু এই পেজে, ব্যবহারকারী পেজ খুললে একবার লোড (lazy)। কোনো SDK/নতুন লাইব্রেরি নেই।
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { bn } from "@/i18n/bn";
import {
  PUBLIC_SEARCH_LIMIT,
  SEARCH_INDEX_PATH,
  parsePublicSearchIndex,
  prepareSearch,
  searchPublic,
  searchResultPath,
} from "@/lib/publicSearch";

const noopSubscribe = () => () => {};

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; prepared: ReturnType<typeof prepareSearch> };

export function SearchClient() {
  const t = bn.publicSearch;
  // ?q= শুধু ক্লায়েন্টে (static পেজ; server-snapshot "" ⇒ hydration-মিল); ব্যবহারকারী টাইপ করলে `typed` জেতে
  const urlQ = useSyncExternalStore(noopSubscribe, () => new URLSearchParams(window.location.search).get("q") ?? "", () => "");
  const [typed, setTyped] = useState<string | null>(null);
  const q = typed ?? urlQ;
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let dead = false;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000); // অনির্দিষ্ট loading নয় (Dev Rules §৭)
    (async () => {
      try {
        const res = await fetch(SEARCH_INDEX_PATH, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const idx = parsePublicSearchIndex(await res.json());
        if (!idx) throw new Error("bad index");
        if (!dead) setLoad({ state: "ready", prepared: prepareSearch(idx) });
      } catch {
        if (!dead) setLoad({ state: "error" });
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      dead = true;
      clearTimeout(timer);
      ctl.abort();
    };
  }, [tick]);

  const results = useMemo(() => (load.state === "ready" ? searchPublic(load.prepared, q) : []), [load, q]);
  const hasQuery = q.trim() !== "";

  return (
    <div className="mt-4 space-y-4">
      <form
        role="search"
        action="/search"
        method="get"
        onSubmit={(e) => {
          e.preventDefault(); // JS চালু থাকলে পেজ-রিলোড ছাড়াই (URL হালনাগাদ)
          const u = new URL(window.location.href);
          if (q.trim()) u.searchParams.set("q", q.trim());
          else u.searchParams.delete("q");
          window.history.replaceState(null, "", u);
        }}
        className="flex gap-2"
      >
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t.placeholder}
          aria-label={t.heading}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-base"
        />
        <button type="submit" className="min-h-11 rounded-lg border border-line bg-surface px-4">
          {t.button}
        </button>
      </form>
      <p className="text-sm text-muted">{t.hint}</p>

      <div aria-live="polite">
        {load.state === "loading" && <p className="text-muted">{t.loading}</p>}
        {load.state === "error" && (
          <p className="text-muted">
            {t.error}{" "}
            <button type="button" onClick={() => { setLoad({ state: "loading" }); setTick((n) => n + 1); }} className="min-h-11 text-accent-text underline">
              {t.retry}
            </button>
          </p>
        )}
        {load.state === "ready" && hasQuery && (
          <>
            <p className="text-sm text-muted">{results.length ? t.results(results.length) : t.none}</p>
            {results.length >= PUBLIC_SEARCH_LIMIT && <p className="text-sm text-muted">{t.limited(PUBLIC_SEARCH_LIMIT)}</p>}
          </>
        )}
      </div>

      <ul className="space-y-3">
        {results.map((e) => (
          <li key={e.s} className="rounded-xl border border-line bg-surface p-4">
            <Link href={searchResultPath(e)} prefetch={false} className="font-serif text-lg font-bold text-accent-text underline">
              {e.t || bn.library.untitled}
            </Link>
            {e.c && <span className="ms-2 text-sm text-muted">{e.c}</span>}
            {e.e && <p className="mt-1 text-sm text-muted">{e.e}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
