"use client";

// পরিসংখ্যান-পেজ (P11a-২; Mockup §৭.২৭): পরিসর বাছাই → `GET /api/owner/stats` → কার্ড, চার্ট, তালিকা।
// লেখার শিরোনাম owner-CSR-এ `posts` থেকে (শুধু দেখানো ~১০টার, memory-cache); না পেলে 'মোছা লেখা'।
import { useCallback, useEffect, useState } from "react";
import { getPostRepo } from "@/data/postRepo.wire";
import { StatsError, fetchStats, type StatsPayload } from "@/data/statsRepo";
import { bn } from "@/i18n/bn";
import { STATS_RANGES, countryLabel, pctChange, referrerLabel, type Point, type StatsRange } from "@/lib/stats";
import { StatsChart } from "./StatsChart";

const T = bn.stats;
const SHOWN = 10;
const num = (n: number) => n.toLocaleString("bn-BD");
const card = "rounded-2xl border border-line bg-surface p-4";
const titleCache = new Map<string, string | null>();

function Change({ cur, prev }: { cur: number; prev: number | null }) {
  const p = pctChange(cur, prev);
  if (p === null || p === 0) return null;
  // রঙে নয়, ↑/↓ চিহ্ন ও % দিয়ে (a11y)
  return (
    <span className="ml-2 text-sm text-muted" title={T.vsPrev}>
      <span aria-hidden="true">{p > 0 ? "↑" : "↓"}</span>
      <span className="sr-only">{p > 0 ? T.up : T.down} </span>
      {num(Math.abs(p))}%
    </span>
  );
}

function Ranked({ title, rows, label }: { title: string; rows: readonly Point[]; label: (k: string) => string }) {
  const [all, setAll] = useState(false);
  if (rows.length === 0) return null;
  const shown = all ? rows : rows.slice(0, SHOWN);
  return (
    <section className={card}>
      <h2 className="mb-2 font-serif text-lg font-bold">{title}</h2>
      <ul>
        {shown.map((r) => (
          <li key={r.k} className="flex min-h-11 items-center justify-between gap-3 border-b border-dashed border-line last:border-0">
            <span className="min-w-0 break-words">{label(r.k)}</span>
            <span className="shrink-0 text-muted">{num(r.n)}</span>
          </li>
        ))}
      </ul>
      {rows.length > SHOWN && (
        <button type="button" onClick={() => setAll(!all)} className="mt-1 inline-flex min-h-11 items-center text-accent-text underline">
          {all ? T.showLess : T.showAll}
        </button>
      )}
    </section>
  );
}

export function StatsView() {
  const [range, setRange] = useState<StatsRange>("7d");
  // ফল ও ত্রুটি নিজের `range` সহ — পরিসর বদলালে পুরনো ফল দেখানো হয় না (effect-এ sync setState ছাড়াই)
  const [res, setRes] = useState<StatsPayload | null>(null);
  const [errState, setErrState] = useState<{ range: StatsRange; kind: "no_db" | "failed" } | null>(null);
  const data = res?.range === range ? res : null;
  const err = errState?.range === range ? errState.kind : null;
  // শিরোনাম-আনা শেষ হলে (সফল/ব্যর্থ) কোন `data`-র জন্য — render-সময়ে 'অপেক্ষা' বনাম 'মোছা লেখা' ঠিক করতে
  const [doneData, setDoneData] = useState<StatsPayload | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    fetchStats(range, ac.signal)
      .then(setRes)
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setErrState({ range, kind: e instanceof StatsError ? e.kind : "failed" });
      });
    return () => ac.abort();
  }, [range, tick]);

  // শীর্ষ লেখাগুলোর শিরোনাম (আগে cache, বাকি `PostRepo.get`; ব্যর্থ হলে চুপচাপ 'মোছা লেখা')
  // effect-এর বডিতে sync setState নেই — শিরোনাম render-সময়ে `titleCache` থেকে; শুধু async শেষে re-render ট্রিগার
  const topIds = data ? data.posts.slice(0, SHOWN).map((p) => p.postId) : [];
  const pending = data !== null && doneData !== data && topIds.some((id) => !titleCache.has(id));

  useEffect(() => {
    if (!data) return;
    const ids = data.posts.slice(0, SHOWN).map((p) => p.postId).filter((id) => !titleCache.has(id));
    if (ids.length === 0) return;
    let dead = false;
    getPostRepo()
      .then((repo) => Promise.all(ids.map((id) => repo.get(id).then((p) => titleCache.set(id, p ? p.title || bn.library.untitled : null)).catch(() => undefined))))
      .catch(() => undefined)
      .then(() => {
        if (!dead) setDoneData(data);
      });
    return () => {
      dead = true;
    };
  }, [data]);

  const retry = useCallback(() => {
    setErrState(null);
    setTick((t) => t + 1);
  }, []);

  return (
    <div className="space-y-4">
      <div role="group" aria-label={T.rangeLabel} className="flex flex-wrap gap-2">
        {STATS_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={range === r}
            onClick={() => setRange(r)}
            className={`min-h-11 rounded-full border px-4 font-medium ${range === r ? "border-btn-bg bg-btn-bg text-btn-tx" : "border-line bg-surface"}`}
          >
            {T.ranges[r]}
          </button>
        ))}
      </div>

      {err ? (
        <div role="alert" className={card}>
          <p className="mb-2">{err === "no_db" ? T.noDb : T.failed}</p>
          {err === "failed" && (
            <button type="button" onClick={retry} className="min-h-11 rounded-full border border-line px-4">
              {T.retry}
            </button>
          )}
        </div>
      ) : !data ? (
        <div className={card} role="status">
          <div className="h-24 animate-pulse rounded-lg bg-line" />
          <span className="sr-only">{T.loading}</span>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={card}>
              <p className="text-sm text-muted">👁 {T.views}</p>
              <p className="text-3xl font-bold">
                {num(data.views)}
                <Change cur={data.views} prev={data.prevViews} />
              </p>
            </div>
            <div className={card}>
              <p className="text-sm text-muted">👥 {T.visitors}</p>
              <p className="text-3xl font-bold">
                {num(data.visitors)}
                <Change cur={data.visitors} prev={data.prevVisitors} />
              </p>
            </div>
          </div>

          {data.views === 0 ? (
            <p className={`${card} text-muted`}>{range === "all" ? T.empty : T.noData}</p>
          ) : (
            <>
              <div className={card}>
                <StatsChart points={data.series} bucket={data.bucket} />
              </div>
              <div className="grid gap-4 min-[1024px]:grid-cols-2">
                <Ranked
                  title={T.topPosts}
                  rows={data.posts.map((p) => ({ k: p.postId, n: p.n }))}
                  label={(id) => (pending ? "…" : (titleCache.get(id) ?? T.deletedPost))}
                />
                <Ranked title={T.referrers} rows={data.referrers} label={(k) => referrerLabel(k, T.direct)} />
              </div>
              <Ranked title={T.countries} rows={data.countries} label={(k) => countryLabel(k, T.unknownCountry)} />
            </>
          )}
        </>
      )}
      <p className="text-sm text-muted">{T.note}</p>
    </div>
  );
}
