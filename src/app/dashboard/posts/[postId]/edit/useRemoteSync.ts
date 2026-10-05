"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { draftStore } from "@/data/draftStore";
import { getPostRepo } from "@/data/postRepo.wire";
import { createSyncEngine, type SyncStatus } from "@/data/syncEngine";

export type SyncEngine = ReturnType<typeof createSyncEngine>;
export type PubInfo = { status: "draft" | "published"; hasUnpublished: boolean };

/** editor-এর Firestore sync: engine-এর React মোড়ক (`postId` বদলালে editor remount হয় — `key` দিয়ে) */
export function useRemoteSync(postId: string, initial: PubInfo) {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [pub, setPub] = useState<PubInfo>(initial);
  // engine একবারই তৈরি (render-এ কোনো side-effect নেই); effect শুধু সক্রিয়/নিষ্ক্রিয় করে — StrictMode-এর দ্বিতীয় mount-ও নিরাপদ
  const [engine] = useState(() =>
    createSyncEngine({
      postId,
      getRepo: getPostRepo,
      store: draftStore,
      onStatus: setStatus,
      onSynced: (r) => setPub({ status: r.status, hasUnpublished: r.hasUnpublished }),
    }),
  );
  const engRef = useRef<SyncEngine | null>(null);

  useEffect(() => {
    engine.revive();
    engRef.current = engine;
    const online = () => void engine.syncNow().catch(() => undefined);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("online", online);
      engine.dispose();
      engRef.current = null;
    };
  }, [engine]);

  const edited = useCallback(() => {
    engRef.current?.edited();
    // প্রকাশিত লেখায় যেকোনো সম্পাদনা = অপ্রকাশিত পরিবর্তন
    setPub((p) => (p.status === "published" && !p.hasUnpublished ? { ...p, hasUnpublished: true } : p));
  }, []);
  const blur = useCallback(() => engRef.current?.blur(), []);

  return { status, pub, setPub, engine, edited, blur };
}
