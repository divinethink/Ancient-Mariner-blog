// লেখার ইতিহাস (revisions)-এর pure যুক্তি (SDK/UI-মুক্ত; P5a)। retention/trigger নীতি: Arch §১৫।
export const REVISION_RETAIN = 20; // প্রতি লেখায় সর্বশেষ ২০টা (prune = Cron, P5a-৩)
export const REVISION_INTERVAL_MS = 10 * 60 * 1000; // সক্রিয় লেখায় সর্বোচ্চ প্রতি ১০ মিনিটে একটা (P5a-২)
export const REVISION_SNAPSHOT_MAX_BYTES = 900 * 1024; // posts.body-র মতো UTF-8 byte (Arch §৬)

export const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length;

/** সর্বশেষ versionNumber (না থাকলে undefined) → পরেরটা */
export const nextVersionNumber = (latest: number | undefined): number =>
  Number.isInteger(latest) && (latest as number) >= 1 ? (latest as number) + 1 : 1;
