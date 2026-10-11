// পাবলিক দিনলিপি-ডেটা (snapshot থেকে, প্রতি worker-এ একবার): দিন → লেখা, দিন → মোট শব্দ। শুধু build-সময়ে।
import { getPublicSettings, listPublicDiary } from "@/data/publicSnapshot";
import { groupByDay, type DiaryEntry } from "@/lib/diaryCalendar";

export type PublicDiary = { tz: string; byDay: Map<string, DiaryEntry[]>; words: Map<string, number> };

let memo: Promise<PublicDiary> | undefined;

export function getPublicDiary(): Promise<PublicDiary> {
  memo ??= Promise.all([listPublicDiary(), getPublicSettings()]).then(([posts, s]) => {
    const byDay = groupByDay(posts, s.timezone);
    const words = new Map([...byDay].map(([d, l]) => [d, l.reduce((n, e) => n + e.words, 0)] as const));
    return { tz: s.timezone, byDay, words };
  });
  return memo;
}
