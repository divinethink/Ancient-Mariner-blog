"use client";

import { useEffect } from "react";

// Service Worker নিবন্ধন (P7b-৩): শুধু production, প্রথম paint-এর পরে (load-এর পর) — boot হালকা রাখতে।
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const reg = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // নিবন্ধন ব্যর্থ হলে সাইট যেমন ছিল তেমনই চলে
      });
    };
    if (document.readyState === "complete") reg();
    else {
      window.addEventListener("load", reg, { once: true });
      return () => window.removeEventListener("load", reg);
    }
  }, []);
  return null;
}
