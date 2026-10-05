"use client";

import { useEffect, useState } from "react";

/** মোবাইলে কিবোর্ড উঠলে নিচে-লাগানো টুলবার কিবোর্ডের ঠিক ওপরে রাখতে visualViewport থেকে ঘাটতি (px) (Arch §১৩) */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
