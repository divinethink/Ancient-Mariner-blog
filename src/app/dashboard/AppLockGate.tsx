"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { logout } from "@/auth/authClient";
import { Icon } from "@/components/icons";
import { clearPasscode, lockoutRemainingMs, unlock, unlockWithBiometric } from "@/data/appLock";
import { hasBiometric } from "@/data/biometric";
import { draftStore } from "@/data/draftStore";
import { getPostRepo } from "@/data/postRepo.wire";
import { syncAllDirty } from "@/data/syncEngine";
import { bn } from "@/i18n/bn";
import { PinPad } from "./PinPad";
import { useAppLocked, useAutoLock } from "./useAppLock";

function LockScreen() {
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(() => Math.ceil(lockoutRemainingMs() / 1000));
  const [confirmOut, setConfirmOut] = useState(false);
  const [outFailed, setOutFailed] = useState(false);
  const bio = hasBiometric();

  // আঙুলের ছাপ সেট থাকলে লক-স্ক্রিন দেখানোর সাথে একবার নিজে থেকে প্রম্পট; বাতিল হলে PIN-প্যাড থাকে
  useEffect(() => {
    if (bio) void unlockWithBiometric();
  }, [bio]);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setInterval(() => setWait(Math.ceil(lockoutRemainingMs() / 1000)), 1000);
    return () => clearInterval(id);
  }, [wait]);

  async function submit(pin: string) {
    const r = await unlock(pin);
    setError(r === "wrong" ? bn.appLock.wrong : null);
    if (r === "locked" || r === "wrong") setWait(Math.ceil(lockoutRemainingMs() / 1000));
  }

  // "পাসকোড ভুলে গেছেন": সাইন-আউট সফল হলেই পাসকোড মোছা (ব্যর্থ হলে লক থাকে); অসংরক্ষিত লেখা থাকলে মেনুর সাইন-আউটের মতোই আগে sync/confirm
  async function forgot() {
    setOutFailed(false);
    try {
      const res = await logout({
        hasUnsynced: () => draftStore.hasUnsynced(),
        sync: async () => {
          await syncAllDirty(await getPostRepo(), draftStore);
        },
        confirmDiscard: () => confirm(bn.auth.confirmDiscard),
      });
      if (res === "done") {
        clearPasscode();
        location.replace("/login");
      }
    } catch {
      setOutFailed(true);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={bn.appLock.lockedLabel}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-bg px-6 py-8 text-text"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={64} height={64} className="mb-5 size-16 rounded-full shadow-sm" />
      <PinPad
        title={bn.appLock.enter}
        subtitle={wait > 0 ? bn.appLock.tooMany.replace("{s}", String(wait)) : undefined}
        error={error}
        disabled={wait > 0}
        onComplete={(pin) => void submit(pin)}
      />
      {bio && (
        <button
          type="button"
          onClick={() => void unlockWithBiometric()}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm"
        >
          <Icon name="fingerprint" size={20} className="text-accent-text" /> {bn.appLock.useBio}
        </button>
      )}
      {!confirmOut ? (
        <button type="button" onClick={() => setConfirmOut(true)} className="mt-6 min-h-11 text-sm text-muted underline">
          {bn.appLock.forgot}
        </button>
      ) : (
        <div className="mt-6 max-w-xs text-center text-sm text-muted">
          <p>{bn.appLock.forgotNote}</p>
          <div className="mt-2 flex justify-center gap-3">
            <button type="button" onClick={() => setConfirmOut(false)} className="min-h-11 px-3">
              {bn.appLock.cancel}
            </button>
            <button type="button" onClick={() => void forgot()} className="min-h-11 px-3 font-semibold text-red-700 dark:text-red-400">
              {bn.auth.signOut}
            </button>
          </div>
          {outFailed && (
            <p role="alert" className="mt-1">
              {bn.auth.signOutFailed}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** পাসকোড সেট থাকলে ড্যাশবোর্ড খোলা/ফেরার সময় লক-স্ক্রিন; নিচের কনটেন্ট mount থাকে (অসংরক্ষিত লেখা হারায় না) কিন্তু ফোকাস/অ্যাক্সেসের বাইরে (inert)। */
export function AppLockGate({ children }: { children: ReactNode }) {
  const locked = useAppLocked();
  useAutoLock();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.toggleAttribute("inert", locked);
  }, [locked]);
  return (
    <>
      <div ref={ref} aria-hidden={locked || undefined}>
        {children}
      </div>
      {locked && <LockScreen />}
    </>
  );
}
