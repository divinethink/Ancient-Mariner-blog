"use client";

import { useState } from "react";

const LONG = 140;

/** লম্বা বর্ণনা ৩ লাইনে ছোট করে দেখায়; [আরও]/[কম] দিয়ে খোলা-বন্ধ। ছোট লেখায় বাটন নেই */
export function ClampText({ text, more, less, className = "" }: { text: string; more: string; less: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > LONG || text.split("\n").length > 3;
  return (
    <div className={className}>
      <p className={`whitespace-pre-line break-words leading-relaxed ${long && !open ? "line-clamp-3" : ""}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="min-h-11 text-sm text-accent-text underline">
          {open ? less : more}
        </button>
      )}
    </div>
  );
}
