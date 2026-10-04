"use client";

import { useState } from "react";
import { logout } from "@/auth/authClient";
import { bn } from "@/i18n/bn";

export function LogoutButton() {
  const [failed, setFailed] = useState(false);

  async function onClick() {
    setFailed(false);
    try {
      if ((await logout({ confirmDiscard: () => confirm(bn.auth.confirmDiscard) })) === "done") {
        location.replace("/login");
      }
    } catch {
      setFailed(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="mt-4 min-h-11 rounded-lg bg-btn-bg px-4 text-btn-tx"
      >
        {bn.auth.signOut}
      </button>
      {failed && (
        <p role="alert" className="mt-2 text-muted">
          {bn.auth.signOutFailed}
        </p>
      )}
    </>
  );
}
