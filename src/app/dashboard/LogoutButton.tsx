"use client";

import { useState } from "react";
import { logout } from "@/auth/authClient";
import { draftStore } from "@/data/draftStore";
import { bn } from "@/i18n/bn";

export function LogoutButton() {
  const [failed, setFailed] = useState(false);

  async function onClick() {
    setFailed(false);
    try {
      const res = await logout({
        // sync P2a-২খ-তে জোড়া হবে; এখন dirty লোকাল ড্রাফট থাকলে মোছার আগে confirm
        hasUnsynced: () => draftStore.hasUnsynced(),
        confirmDiscard: () => confirm(bn.auth.confirmDiscard),
      });
      if (res === "done") {
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
