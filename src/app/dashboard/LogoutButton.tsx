"use client";

import { useState } from "react";
import { logout } from "@/auth/authClient";
import { draftStore } from "@/data/draftStore";
import { getPostRepo } from "@/data/postRepo.wire";
import { syncAllDirty } from "@/data/syncEngine";
import { bn } from "@/i18n/bn";

export function LogoutButton() {
  const [failed, setFailed] = useState(false);

  async function onClick() {
    setFailed(false);
    try {
      const res = await logout({
        // আগে sync চেষ্টা; তারপরও সংরক্ষণহীন থাকলে মোছার আগে confirm (Arch §৫)
        hasUnsynced: () => draftStore.hasUnsynced(),
        sync: async () => {
          await syncAllDirty(await getPostRepo(), draftStore);
        },
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
