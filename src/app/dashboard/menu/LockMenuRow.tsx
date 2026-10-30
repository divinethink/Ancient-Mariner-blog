"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { lockNow } from "@/data/appLock";
import { bn } from "@/i18n/bn";
import { useHasPasscode } from "../useAppLock";

/** মেনুর "সিস্টেম" গ্রুপে: পাসকোড ও লক (চালু/বন্ধ ব্যাজসহ) + চালু থাকলে এক-ট্যাপে "এখনই লক করুন" */
export function LockMenuRow() {
  const has = useHasPasscode();
  const cls = "flex min-h-12 items-center gap-3 px-4";
  return (
    <>
      <li>
        <Link href="/dashboard/settings/lock" className={cls}>
          <Icon name="fingerprint" size={20} className="shrink-0 text-muted" />
          <span className="flex-1">{bn.appLock.menu}</span>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${has ? "bg-btn-bg text-btn-tx" : "border border-line text-muted"}`}
          >
            {has ? bn.appLock.on : bn.appLock.off}
          </span>
          <Icon name="chevron" size={18} className="shrink-0 text-muted" />
        </Link>
      </li>
      {has && (
        <li>
          <button type="button" onClick={() => lockNow()} className={`${cls} w-full text-start`}>
            <Icon name="lock" size={20} className="shrink-0 text-muted" />
            <span className="flex-1">{bn.appLock.lockNow}</span>
          </button>
        </li>
      )}
    </>
  );
}
