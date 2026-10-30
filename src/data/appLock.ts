// ড্যাশবোর্ড লক-স্টোর — শুধু এই ডিভাইসে (localStorage, prefs-এর মাধ্যমে): PIN-এর salt+hash ও ভুল-চেষ্টার গণনা।
// PIN/hash Firestore-এ যায় না। হিসাব-নিকাশ অ্যাপের একই নকশা; এটা স্ক্রিন-লক, ডেটা-encryption নয় (Arch §১ নং ৬: localStorage শুধু localStore.ts দিয়ে)।
import { FREE_TRIES, PBKDF2_ITERATIONS, hashPin, isValidPin, lockoutUntil, newSaltB64, safeEqual } from "@/lib/passcode";
import { disableBiometric, hasBiometric, verifyBiometric } from "./biometric";
import { prefs } from "./localStore";

const KEY = "am.applock.v1";
const FAIL_KEY = "am.applock.fail.v1";

interface Stored {
  v: 1;
  salt: string;
  hash: string;
  iter: number;
}
interface Fail {
  count: number;
  until: number;
}

function readStored(): Stored | null {
  try {
    const raw = prefs.get(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<Stored>;
    return o.v === 1 && typeof o.salt === "string" && typeof o.hash === "string" && typeof o.iter === "number" ? (o as Stored) : null;
  } catch {
    return null;
  }
}
function readFail(): Fail {
  try {
    const o = JSON.parse(prefs.get(FAIL_KEY) ?? "{}") as Partial<Fail>;
    return { count: Number(o.count) || 0, until: Number(o.until) || 0 };
  } catch {
    return { count: 0, until: 0 };
  }
}
function writeFail(f: Fail): void {
  if (f.count === 0) prefs.remove(FAIL_KEY);
  else prefs.set(FAIL_KEY, JSON.stringify(f));
}

export function hasPasscode(): boolean {
  return readStored() !== null;
}

// ---- lock অবস্থা (in-memory, subscribe-যোগ্য) ----
let locked = hasPasscode(); // কোল্ড-স্টার্টে PIN থাকলে লক
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribeLock(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export const isLocked = (): boolean => locked && hasPasscode();

export function lockNow(): void {
  if (hasPasscode()) {
    locked = true;
    emit();
  }
}

export async function setPasscode(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error("Invalid passcode");
  const salt = newSaltB64();
  const hash = await hashPin(pin, salt, PBKDF2_ITERATIONS);
  prefs.set(KEY, JSON.stringify({ v: 1, salt, hash, iter: PBKDF2_ITERATIONS } satisfies Stored));
  if (!readStored()) throw new Error("storage unavailable"); // prefs নীরবে ব্যর্থ হয় — পড়ে যাচাই; UI জানাবে
  writeFail({ count: 0, until: 0 });
  locked = false;
  emit();
}

export function clearPasscode(): void {
  prefs.remove(KEY);
  prefs.remove(FAIL_KEY);
  disableBiometric(); // PIN ছাড়া বায়োমেট্রিক-আনলক থাকে না
  locked = false;
  emit();
}

export function lockoutRemainingMs(now: number = Date.now()): number {
  return Math.max(0, readFail().until - now);
}

export type TryResult = "ok" | "wrong" | "locked";

/** PIN যাচাই + ভুল-চেষ্টার throttle। লক খোলে না। */
export async function tryPasscode(pin: string, now: number = Date.now()): Promise<TryResult> {
  const stored = readStored();
  if (!stored) return "ok";
  if (lockoutRemainingMs(now) > 0) return "locked";
  const hash = await hashPin(pin, stored.salt, stored.iter);
  if (safeEqual(hash, stored.hash)) {
    writeFail({ count: 0, until: 0 });
    return "ok";
  }
  const count = readFail().count + 1;
  writeFail({ count, until: lockoutUntil(count, now) });
  return "wrong";
}

/** লক-স্ক্রিন থেকে: ঠিক PIN হলে লক খোলে */
export async function unlock(pin: string, now: number = Date.now()): Promise<TryResult> {
  const r = await tryPasscode(pin, now);
  if (r === "ok") {
    locked = false;
    emit();
  }
  return r;
}

/** লক-স্ক্রিন থেকে: বায়োমেট্রিক সেট থাকলে ফোনের যাচাই; সফল হলে লক খোলে (ব্যর্থ হলে PIN) */
export async function unlockWithBiometric(): Promise<boolean> {
  if (!hasPasscode() || !hasBiometric()) return false;
  const ok = await verifyBiometric();
  if (ok) {
    locked = false;
    emit();
  }
  return ok;
}

export { FREE_TRIES };
