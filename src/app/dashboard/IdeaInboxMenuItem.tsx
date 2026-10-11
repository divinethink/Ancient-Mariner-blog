"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
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
    <Link href="/dashboard/ideas" className="flex min-h-12 items-center gap-3 px-4">
      <Icon name="inbox" size={20} className="shrink-0 text-muted" />
      <span className="flex-1">
        {bn.dashboard.ideasInbox}
        {count !== null && count > 0 ? ` ${bn.ideas.menuCount(count)}` : ""}
      </span>
      <Icon name="chevron" size={18} className="shrink-0 text-muted" />
    </Link>
  );
}
