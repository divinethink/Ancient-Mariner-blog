"use client";

// সাময়িক ডিবাগ প্যানেল: শুধু ?debug=1 থাকলে চালু (?debug=0 বন্ধ)। পাতা কেন ডানে-বামে সরে তা ধরতে।
// DOM সরাসরি লেখে (React state নয়) ও pointer-events বন্ধ, তাই পাতার আচরণ বদলায় না।
import { useEffect } from "react";

const KEY = "dbg";

function describe(el: Element | null): string {
  if (!el) return "?";
  const c = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
  return `${el.tagName.toLowerCase()}${c ? "." + c : ""}`.slice(0, 48);
}

export function DebugOverlay() {
  useEffect(() => {
    let on = false;
    try {
      const q = new URLSearchParams(location.search).get("debug");
      if (q === "1") sessionStorage.setItem(KEY, "1");
      if (q === "0") sessionStorage.removeItem(KEY);
      on = sessionStorage.getItem(KEY) === "1";
    } catch {
      on = false;
    }
    if (!on) return;

    const box = document.createElement("pre");
    box.setAttribute("data-debug", "1");
    box.style.cssText =
      "position:fixed;top:0;left:0;max-width:100%;margin:0;padding:4px 6px;z-index:2147483647;pointer-events:none;" +
      "background:rgba(0,0,0,.82);color:#7CFC8A;font:10px/1.3 monospace;white-space:pre-wrap;word-break:break-all;overflow:hidden;";
    document.body.appendChild(box);

    const log: string[] = [];
    const t0 = Date.now();
    const push = (s: string) => {
      log.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${s}`);
      if (log.length > 7) log.shift();
    };
    let maxSX = 0;
    let maxVV = 0;
    let minScale = 1;

    const wide = () => {
      const iw = window.innerWidth;
      const out: string[] = [];
      for (const el of document.body.querySelectorAll("*")) {
        if (out.length >= 4) break;
        if (el.closest("[data-debug]")) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right > iw + 1 || r.left < -1) {
          // overflow-কাটা/স্ক্রলযোগ্য অভিভাবকের ভেতরের হলে পাতা চওড়া করে না
          let clipped = false;
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const ox = getComputedStyle(p).overflowX;
            if (ox !== "visible") {
              clipped = true;
              break;
            }
          }
          if (!clipped) out.push(`${describe(el)} L${Math.round(r.left)} R${Math.round(r.right)}`);
        }
      }
      return out;
    };

    const render = () => {
      const vv = window.visualViewport;
      const de = document.documentElement;
      const sx = Math.round(window.scrollX);
      const off = Math.round(vv?.offsetLeft ?? 0);
      const pl = Math.round(vv?.pageLeft ?? 0);
      const sc = vv?.scale ?? 1;
      maxSX = Math.max(maxSX, Math.abs(sx));
      maxVV = Math.max(maxVV, Math.abs(off), Math.abs(pl));
      minScale = Math.min(minScale, sc);
      box.textContent =
        `iw ${window.innerWidth} | docSW ${de.scrollWidth} | bodySW ${document.body.scrollWidth} | vvW ${Math.round(vv?.width ?? 0)}\n` +
        `scrollX ${sx} (max ${maxSX}) | vv.offL ${off} pageL ${pl} (max ${maxVV}) | scale ${sc.toFixed(2)} (min ${minScale.toFixed(2)})\n` +
        `wide: ${wide().join(" ; ") || "none"}\n` +
        log.join("\n");
    };

    let moves = 0;
    let startX = 0;
    const onStart = (e: TouchEvent) => {
      moves = 0;
      startX = e.touches[0]?.clientX ?? 0;
      push(`start x${Math.round(startX)} on ${describe(e.target as Element)}`);
      render();
    };
    const onMove = () => {
      moves++;
    };
    const onEnd = (e: TouchEvent) => {
      const x = e.changedTouches[0]?.clientX ?? 0;
      push(`end dx${Math.round(x - startX)} moves${moves}`);
      render();
    };
    const onCancel = () => {
      push(`TOUCHCANCEL moves${moves} (ব্রাউজার টান নিয়ে নিয়েছে)`);
      render();
    };
    const onVV = () => {
      const vv = window.visualViewport;
      push(`vv off${Math.round(vv?.offsetLeft ?? 0)} pg${Math.round(vv?.pageLeft ?? 0)} sc${(vv?.scale ?? 1).toFixed(2)}`);
      render();
    };
    const onScroll = () => {
      push(`window scrollX ${Math.round(window.scrollX)}`);
      render();
    };

    const opt = { capture: true, passive: true } as const;
    document.addEventListener("touchstart", onStart, opt);
    document.addEventListener("touchmove", onMove, opt);
    document.addEventListener("touchend", onEnd, opt);
    document.addEventListener("touchcancel", onCancel, opt);
    window.visualViewport?.addEventListener("resize", onVV);
    window.visualViewport?.addEventListener("scroll", onVV);
    window.addEventListener("scroll", onScroll, { passive: true });
    const id = window.setInterval(render, 700);
    render();

    return () => {
      document.removeEventListener("touchstart", onStart, opt);
      document.removeEventListener("touchmove", onMove, opt);
      document.removeEventListener("touchend", onEnd, opt);
      document.removeEventListener("touchcancel", onCancel, opt);
      window.visualViewport?.removeEventListener("resize", onVV);
      window.visualViewport?.removeEventListener("scroll", onVV);
      window.removeEventListener("scroll", onScroll);
      window.clearInterval(id);
      box.remove();
    };
  }, []);
  return null;
}
