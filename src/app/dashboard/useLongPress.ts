"use client";

import { useRef, type MouseEvent, type PointerEvent } from "react";

/**
 * কার্ডে long-press (≈৫০০ms) ⇒ select-mode (Mockup §৭.৬)। ref-ভিত্তিক — re-render-এর পরেও 'fired' মনে থাকে,
 * তাই আঙুল তোলার click-এ লেখা খুলে যায় না। আঙুল >১০px নড়লে বা ছাড়লে বাতিল।
 * touch-ছাড়া মাউসে সাধারণত ☑-বোতামই (নির্বাচন) ব্যবহৃত; তবু একই handler কাজ করে।
 */
export function useLongPress(onLong: (id: string) => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fired = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const clear = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  return (id: string) => ({
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = setTimeout(() => {
        fired.current = true;
        onLong(id);
      }, ms);
    },
    onPointerMove: (e: PointerEvent) => {
      if (
        timer.current &&
        Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10
      )
        clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: MouseEvent) => {
      if (fired.current) e.preventDefault(); // মোবাইলে long-press-এর ব্রাউজার-মেনু আটকানো
    },
    onClick: (e: MouseEvent) => {
      if (fired.current) {
        e.preventDefault(); // long-press-এর পরের click নেভিগেট করবে না
        fired.current = false;
      }
    },
  });
}
