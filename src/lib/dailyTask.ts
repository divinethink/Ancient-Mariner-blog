// 'আজকের একটি কাজ' (দিনলিপি-ছ): হোমে একটাই ছোট সুপারিশ। pure; বাছাই দিন-key থেকে নির্ধারিত (একই দিনে একই কাজ)। ডিফল্ট বন্ধ, চাপ/গোনা নেই।
export const DAILY_TASKS = [
  { id: "read", href: "/dashboard/shelf" },
  { id: "write", href: "/dashboard/posts/new" },
  { id: "idea", href: "/dashboard/ideas" },
  { id: "diary", href: "/dashboard/diary" },
  { id: "quote", href: "/dashboard/shelf/quotes" },
] as const;
export type DailyTaskId = (typeof DAILY_TASKS)[number]["id"];

const dayNum = (key: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return m ? Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000) : 0;
};

export function dailyTaskFor(day: string): (typeof DAILY_TASKS)[number] {
  const n = DAILY_TASKS.length;
  return DAILY_TASKS[((dayNum(day) % n) + n) % n]!;
}
