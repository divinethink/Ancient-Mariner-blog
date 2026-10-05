"use client";

import { useState } from "react";
import { bn } from "@/i18n/bn";

type Props = {
  label: string;
  /** নিশ্চিতকরণের প্রশ্ন */
  question: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
};

/** দুই-ধাপের ঝুঁকিপূর্ণ বোতাম: প্রথম চাপে প্রশ্ন, দ্বিতীয় চাপে কাজ (window.confirm নয় — মোবাইল PWA-তে অনির্ভরযোগ্য) */
export function ConfirmButton({ label, question, onConfirm, disabled, className }: Props) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" disabled={disabled} onClick={() => setAsking(true)} className={className}>
        {label}
      </button>
    );
  }
  return (
    <span role="alertdialog" aria-label={question} className="flex flex-wrap items-center gap-2">
      <span className="text-sm">{question}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
        className="min-h-11 rounded-full bg-btn-bg px-4 text-btn-tx disabled:opacity-50"
      >
        {bn.trash.yes}
      </button>
      <button type="button" onClick={() => setAsking(false)} className="min-h-11 rounded-full border border-line px-4">
        {bn.trash.cancel}
      </button>
    </span>
  );
}
