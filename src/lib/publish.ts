// প্রকাশের তারিখ-ইনপুট যাচাই (Arch §১৭ P2a: ভবিষ্যৎ নয় — ভবিষ্যতের জন্য Schedule, P11c)। SDK/UI-মুক্ত।
import { fromZonedInput } from "./datetime";

export type PublishDateResult =
  | { ok: true; date: Date | undefined } // undefined = খালি = প্রকাশের মুহূর্ত
  | { ok: false; reason: "invalid" | "future" };

const FUTURE_TOLERANCE_MS = 60_000; // ঘড়ির সামান্য পার্থক্য/মিনিট-রাউন্ডিং সহ্য

export function parsePublishDate(input: string, now: number, timeZone?: string): PublishDateResult {
  if (input.trim() === "") return { ok: true, date: undefined };
  const d = fromZonedInput(input, timeZone);
  if (!d) return { ok: false, reason: "invalid" };
  if (d.getTime() > now + FUTURE_TOLERANCE_MS) return { ok: false, reason: "future" };
  return { ok: true, date: d };
}
