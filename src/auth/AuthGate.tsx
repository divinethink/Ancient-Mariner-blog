"use client";

import { useEffect, useState, type ReactNode } from "react";
import { bn } from "@/i18n/bn";
import { clearServerSession, watchAuth } from "./authClient";

type State = "checking" | "ready" | "error";

// cookie বৈধ কিন্তু Firebase-সেশন নেই (যেমন IndexedDB মোছা) → cookie মুছে /login-এ; লুপ নেই (Arch §৫)
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let dead = false;
    let off: () => void = () => undefined;
    watchAuth((signedIn) => {
      if (dead) return;
      if (signedIn) return setState("ready");
      clearServerSession()
        .then(() => location.replace(`/login?next=${encodeURIComponent(location.pathname)}`))
        .catch(() => setState("error"));
    })
      .then((unsub) => {
        if (dead) unsub();
        else off = unsub;
      })
      .catch(() => setState("error"));
    return () => {
      dead = true;
      off();
    };
  }, []);

  if (state === "ready") return <>{children}</>;
  return (
    <p role="status" aria-live="polite" className="text-muted">
      {state === "error" ? bn.auth.sessionLost : bn.auth.checking}
    </p>
  );
}
