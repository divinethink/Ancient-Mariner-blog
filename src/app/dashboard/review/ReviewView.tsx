"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BookWithId } from "@/data/bookRepo";
import { getBookRepo } from "@/data/bookRepo.wire";
import type { PostWithId } from "@/data/postRepo";
import { getPostRepo } from "@/data/postRepo.wire";
import { listPostsUpdatedBetween } from "@/data/reviewRepo.client";
import { bn } from "@/i18n/bn";
import { dayKey, fromZonedInput } from "@/lib/datetime";
import { addDays } from "@/lib/letters";
import { inRange, weekRange } from "@/lib/week";
import { useSiteTimezone } from "../SiteSettingsProvider";

const bnNum = (n: number) => n.toLocaleString("bn-BD", { useGrouping: false });
const dayText = (k: string) => `${bnNum(Number(k.slice(8, 10)))} ${bn.diary.months[Number(k.slice(5, 7)) - 1]}`;

type Data = { writings: PostWithId[]; diary: PostWithId[]; finished: BookWithId[]; started: BookWithId[] };

/** সাপ্তাহিক পর্যালোচনা (দিনলিপি-ছ): রবি–শনি এক পাতায় — লেখা, দিনলিপি, বই। শুধু পড়া; কিছু সংরক্ষণ হয় না; চাপ/ঘাটতি-গণনা নেই */
export function ReviewView() {
  const tz = useSiteTimezone();
  const [today] = useState(() => dayKey(Date.now(), tz));
  const [offset, setOffset] = useState(0); // ০ = এই সপ্তাহ; ঋণাত্মক = আগের
  const [data, setData] = useState<Data | undefined>();
  const [failed, setFailed] = useState(false);
  const { from, to } = weekRange(today, offset);

  useEffect(() => {
    let dead = false;
    const range = weekRange(today, offset);
    const a = fromZonedInput(`${range.from}T00:00`, tz)?.getTime();
    const b = fromZonedInput(`${addDays(range.to, 1)}T00:00`, tz)?.getTime();
    Promise.resolve()
      .then(() => {
        if (a === undefined || b === undefined) throw new Error("সপ্তাহের সীমা বোঝা যায়নি");
        return Promise.all([listPostsUpdatedBetween(a, b), getPostRepo().then((r) => r.listDiary(range)), getBookRepo().then((r) => r.list())]);
      })
      .then(([posts, diary, books]) => {
        if (dead) return;
        setData({
          writings: posts.filter((p) => p.status !== "trashed" && p.contentType !== "diary"),
          diary,
          finished: books.filter((x) => x.status === "finished" && inRange(x.endDay, range.from, range.to)),
          started: books.filter((x) => inRange(x.startDay, range.from, range.to)),
        });
        setFailed(false);
      })
      .catch(() => {
        if (!dead) setFailed(true);
      });
    return () => {
      dead = true;
    };
  }, [offset, today, tz]);

  const label = `${dayText(from)} – ${dayText(to)} ${bnNum(Number(to.slice(0, 4)))}`;
  const empty = data && data.writings.length + data.diary.length + data.finished.length + data.started.length === 0;
  const nav = "flex size-11 items-center justify-center rounded-full border border-line disabled:opacity-40";
  const card = "mt-4 rounded-2xl border border-line bg-surface p-4";
  const diaryDays = data ? new Set(data.diary.map((d) => d.date).filter(Boolean)).size : 0;
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <button type="button" aria-label={bn.review.prev} onClick={() => { setData(undefined); setOffset((o) => o - 1); }} className={nav}>
          ‹
        </button>
        <p className="text-center font-semibold" aria-live="polite">
          {offset === 0 ? `${bn.review.thisWeek} · ` : ""}
          {label}
        </p>
        <button type="button" aria-label={bn.review.next} disabled={offset >= 0} onClick={() => { setData(undefined); setOffset((o) => Math.min(0, o + 1)); }} className={nav}>
          ›
        </button>
      </div>
      {failed && <p role="alert" className="mt-4 text-accent-text">{bn.review.loadFailed}</p>}
      {!data && !failed && <p className="mt-4 text-muted">{bn.review.loading}</p>}
      {data && empty && <p className="mt-4 text-muted">{bn.review.empty}</p>}
      {data && data.writings.length > 0 && (
        <section className={card} aria-label={bn.review.title}>
          <h2 className="mb-2 text-sm text-muted">✍️ {bn.review.writings(bnNum(data.writings.length))}</h2>
          <ul className="space-y-1">
            {data.writings.slice(0, 15).map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/posts/${p.id}/edit`} className="flex min-h-11 items-center font-serif text-base">
                  {p.title || bn.library.untitled}
                </Link>
              </li>
            ))}
          </ul>
          {data.writings.length > 15 && <p className="text-sm text-muted">{bn.review.more(bnNum(data.writings.length - 15))}</p>}
        </section>
      )}
      {data && data.diary.length > 0 && (
        <section className={card} aria-label={bn.review.diary}>
          <h2 className="text-sm text-muted">📔 {bn.review.diary}</h2>
          <p className="font-serif text-base">{bn.review.diaryCount(bnNum(data.diary.length), bnNum(diaryDays))}</p>
        </section>
      )}
      {data && (data.finished.length > 0 || data.started.length > 0) && (
        <section className={card} aria-label={bn.review.books}>
          <h2 className="mb-2 text-sm text-muted">📚 {bn.review.books}</h2>
          {data.finished.length > 0 && (
            <p className="font-serif text-base">
              {bn.review.finished}: {data.finished.map((b) => b.title).join(", ")}
            </p>
          )}
          {data.started.length > 0 && (
            <p className="font-serif text-base">
              {bn.review.started}: {data.started.map((b) => b.title).join(", ")}
            </p>
          )}
        </section>
      )}
    </>
  );
}
