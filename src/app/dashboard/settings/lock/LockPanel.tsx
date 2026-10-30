"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Toggle } from "@/components/ui/Toggle";
import { clearPasscode, lockNow, lockoutRemainingMs, setPasscode, tryPasscode } from "@/data/appLock";
import { biometricSupported, disableBiometric, enableBiometric, hasBiometric } from "@/data/biometric";
import { bn } from "@/i18n/bn";
import { PinPad } from "../../PinPad";
import { useHasPasscode } from "../../useAppLock";

type Step = { k: "home" } | { k: "verify"; then: "change" | "off" } | { k: "new" } | { k: "confirm"; first: string };

const row = "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent";

/** পাসকোড চালু/বদল/বন্ধ + আঙুলের ছাপ আনলক। PIN শুধু এই ডিভাইসে hash হয়ে থাকে; অন্য ডিভাইসে আলাদা চালু করতে হয়। */
export function LockPanel() {
  const has = useHasPasscode();
  const [step, setStep] = useState<Step>({ k: "home" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);
  // AuthGate-এর ভেতরে (client-এ mount-এর পর) বলে lazy-read hydration-নিরাপদ
  const [bioOn, setBioOn] = useState(hasBiometric);

  useEffect(() => {
    let alive = true;
    void biometricSupported().then((ok) => alive && setBioSupported(ok));
    return () => {
      alive = false;
    };
  }, []);

  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };

  async function toggleBio(next: boolean) {
    if (busy) return;
    setNotice(null);
    if (!next) {
      disableBiometric();
      setBioOn(false);
      return;
    }
    setBusy(true);
    try {
      const ok = await enableBiometric();
      setBioOn(ok);
      setNotice(ok ? bn.appLock.bioOn : bn.appLock.bioFail);
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(pin: string, then: "change" | "off") {
    if (busy) return;
    setBusy(true);
    try {
      const r = await tryPasscode(pin);
      if (r === "ok") {
        if (then === "off") {
          clearPasscode();
          setBioOn(false);
          setNotice(bn.appLock.removed);
          go({ k: "home" });
        } else go({ k: "new" });
      } else if (r === "locked") {
        setError(bn.appLock.tooMany.replace("{s}", String(Math.ceil(lockoutRemainingMs() / 1000))));
      } else setError(bn.appLock.wrong);
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm(pin: string, first: string) {
    if (busy) return;
    if (pin !== first) {
      setError(bn.appLock.mismatch);
      setStep({ k: "new" });
      return;
    }
    setBusy(true);
    try {
      await setPasscode(pin);
      setNotice(bn.appLock.saved);
      go({ k: "home" });
    } catch {
      setError(bn.appLock.saveFailed);
      setStep({ k: "new" });
    } finally {
      setBusy(false);
    }
  }

  if (step.k !== "home") {
    const title = step.k === "verify" ? bn.appLock.enterCurrent : step.k === "new" ? bn.appLock.chooseNew : bn.appLock.confirm;
    return (
      <section className="rounded-2xl border border-line bg-surface px-4 pb-6 pt-3">
        <button type="button" onClick={() => go({ k: "home" })} className="mb-2 min-h-11 text-accent-text">
          {bn.appLock.back}
        </button>
        <PinPad
          title={title}
          error={error}
          disabled={busy}
          onComplete={(p) => {
            if (step.k === "verify") void onVerify(p, step.then);
            else if (step.k === "new") go({ k: "confirm", first: p });
            else void onConfirm(p, step.first);
          }}
        />
      </section>
    );
  }

  return (
    <>
      <section className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-4">
        <span
          aria-hidden="true"
          className={`flex size-12 shrink-0 items-center justify-center rounded-full ${has ? "bg-btn-bg text-btn-tx" : "bg-line text-muted"}`}
        >
          <Icon name="lock" size={22} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">
            {bn.appLock.menu}: <span className={has ? "text-accent-text" : "text-muted"}>{has ? bn.appLock.on : bn.appLock.off}</span>
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{bn.appLock.intro}</p>
        </div>
      </section>

      {notice && (
        <p role="status" className="mt-3 rounded-xl border border-line bg-surface p-3 text-sm">
          {notice}
        </p>
      )}

      {!has ? (
        <>
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              go({ k: "new" });
            }}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-btn-bg px-4 font-semibold text-btn-tx"
          >
            <Icon name="lock" size={18} /> {bn.appLock.set}
          </button>
          <p className="mt-3 text-sm text-muted">{bn.appLock.bioAfterSet}</p>
        </>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
          <li>
            <button type="button" onClick={() => lockNow()} className={row}>
              <Icon name="lock" size={20} className="shrink-0 text-muted" />
              <span className="flex-1">{bn.appLock.lockNow}</span>
            </button>
          </li>
          <li className="px-4">
            <Toggle
              checked={bioOn}
              onChange={(v) => void toggleBio(v)}
              label={
                <span className="inline-flex items-center gap-3">
                  <Icon name="fingerprint" size={20} className="shrink-0 text-muted" />
                  {bn.appLock.bio}
                </span>
              }
              hint={bioSupported ? bn.appLock.bioHint : bn.appLock.bioUnavailable}
            />
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                go({ k: "verify", then: "change" });
              }}
              className={row}
            >
              <Icon name="settings" size={20} className="shrink-0 text-muted" />
              <span className="flex-1">{bn.appLock.change}</span>
              <Icon name="chevron" size={18} className="shrink-0 text-muted" />
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                go({ k: "verify", then: "off" });
              }}
              className={`${row} text-red-700 dark:text-red-400`}
            >
              <span className="flex-1 ps-8">{bn.appLock.turnOff}</span>
            </button>
          </li>
        </ul>
      )}
    </>
  );
}
