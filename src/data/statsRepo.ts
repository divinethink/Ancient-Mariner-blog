// পরিসংখ্যান পড়ার client-side boundary (P11a-২): `GET /api/owner/stats` → Zod-যাচাই। Firebase লাগে না (cookie-session)।
import { z } from "zod";
import { STATS_RANGES, type StatsRange } from "@/lib/stats";

const Point = z.object({ k: z.string(), n: z.number().int().nonnegative() });
export const StatsPayloadSchema = z.object({
  range: z.enum(STATS_RANGES),
  from: z.string(),
  to: z.string(),
  bucket: z.enum(["day", "month"]),
  views: z.number().int().nonnegative(),
  visitors: z.number().int().nonnegative(),
  prevViews: z.number().int().nonnegative().nullable(),
  prevVisitors: z.number().int().nonnegative().nullable(),
  series: z.array(Point),
  posts: z.array(z.object({ postId: z.string(), n: z.number().int().nonnegative() })),
  referrers: z.array(Point),
  countries: z.array(Point),
});
export type StatsPayload = z.infer<typeof StatsPayloadSchema>;

/** `no_db` = D1 binding নেই (গণনা চালু হয়নি); বাকি ব্যর্থতা = 'failed' */
export class StatsError extends Error {
  constructor(readonly kind: "no_db" | "failed") {
    super(kind);
  }
}

export async function fetchStats(range: StatsRange, signal?: AbortSignal): Promise<StatsPayload> {
  const res = await fetch(`/api/owner/stats?range=${range}`, { cache: "no-store", signal });
  if (res.status === 503) throw new StatsError("no_db");
  if (!res.ok) throw new StatsError("failed");
  const parsed = StatsPayloadSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new StatsError("failed");
  return parsed.data;
}
