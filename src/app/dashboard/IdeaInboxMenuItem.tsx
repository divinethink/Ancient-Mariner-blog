"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getNoteRepo } from "@/data/noteRepo.wire";
import { bn } from "@/i18n/bn";

/** মেনুর 'আইডিয়া ও ইনবক্স (N)' — N = অসংগঠিত নোট; সংখ্যা না এলে (অফলাইন ইত্যাদি) চুপচাপ বাদ */
export function IdeaInboxMenuItem() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let dead = false;
    getNoteRepo()
      .then((r) => r.countInbox())
      .then((n) => {
        if (!dead) setCount(n);
      })
      .catch(() => undefined);
    return () => {
      dead = true;
    };
  }, []);
  return (
    <Link href="/dashboard/ideas" className="flex min-h-12 items-center justify-between px-4">
      <span>
        💡 {bn.dashboard.ideasInbox}
        {count !== null && count > 0 ? ` ${bn.ideas.menuCount(count)}` : ""}
      </span>
      <span aria-hidden className="text-muted">
        ›
      </span>
    </Link>
  );
}
