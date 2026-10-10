"use client";

import { useState } from "react";
import { signInWithGoogle } from "@/auth/authClient";
import { bn } from "@/i18n/bn";

type View = "idle" | "loading" | "not-owner" | "error";

export function LoginForm({ next }: { next: string }) {
  const [view, setView] = useState<View>("idle");
  const [detail, setDetail] = useState("");

  async function onClick() {
    setView("loading");
    setDetail("");
    const r = await signInWithGoogle();
    if (r.status === "ok") return location.replace(next);
    if (r.status === "error") setDetail(r.detail ?? "");
    setView(r.status === "cancelled" ? "idle" : r.status);
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <button
        type="button"
        onClick={onClick}
        disabled={view === "loading"}
        className="min-h-11 rounded-lg bg-btn-bg px-5 text-btn-tx disabled:opacity-60"
      >
        {view === "loading" ? bn.auth.signingIn : view === "not-owner" ? bn.auth.tryOther : bn.auth.signIn}
      </button>
      <p role="alert" aria-live="polite" className="min-h-6 text-muted">
        {view === "not-owner" && bn.auth.notOwner}
        {view === "error" && bn.auth.failed}
        {view === "error" && detail && (
          <code className="mt-1 block break-all text-xs">{detail}</code>
        )}
      </p>
    </div>
  );
}
