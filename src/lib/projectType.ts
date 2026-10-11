// প্রজেক্টের ধরন: প্রিসেট (key সংরক্ষিত) বা owner-এর মুক্ত লেখা (নিজের লেখাই সংরক্ষিত) — pure, SDK/UI-মুক্ত
import { PROJECT_TYPE, PROJECT_TYPE_MAX } from "./enums";

export const TYPE_OTHER = "__other__";
const isPreset = (v: string) => (PROJECT_TYPE as readonly string[]).includes(v);

/** সংরক্ষিত মান → দেখানোর নাম (প্রিসেট হলে বাংলা লেবেল, নইলে নিজের লেখা) */
export function typeLabel(stored: string, labels: Record<string, string>): string {
  return labels[stored] ?? stored;
}

/** সংরক্ষিত মান → select ও টেক্সট-বক্সের অবস্থা */
export function splitType(stored: string): { select: string; custom: string } {
  return isPreset(stored) ? { select: stored, custom: "" } : { select: TYPE_OTHER, custom: stored };
}

/** select + টেক্সট → সংরক্ষণের মান; ফাঁকা 'নতুন' হলে null। কাস্টম লেখা কোনো প্রিসেটের বাংলা নামের সমান হলে সেই প্রিসেট-key */
export function resolveType(select: string, custom: string, labels: Record<string, string>): string | null {
  if (select !== TYPE_OTHER) return isPreset(select) ? select : null;
  const t = custom.trim().replace(/\s+/g, " ").slice(0, PROJECT_TYPE_MAX);
  if (!t) return null;
  const hit = PROJECT_TYPE.find((k) => labels[k] === t);
  return hit ?? t;
}
