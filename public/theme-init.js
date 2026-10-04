// FOUC এড়াতে pre-hydration থিম-script (Arch §১১) — external ফাইল, তাই CSP `script-src 'self'`-এই চলে।
// পছন্দ: localStorage 'theme' → নইলে <html data-default-theme> (= siteSettings.defaultTheme)।
// bg-মান tokens.css-এর --bg-র সাথে মিলিয়ে রাখতে হবে (theme-color meta-র জন্য)।
(function () {
  var BG = {
    light: "#faf9f5",
    sepia: "#f4ecd8",
    warm: "#f7e0bc",
    dark: "#1c1b19",
    amoled: "#000000",
  };
  try {
    var root = document.documentElement;
    var pref = null;
    try {
      pref = localStorage.getItem("theme");
    } catch (e) {}
    if (!pref) pref = root.getAttribute("data-default-theme") || "light";
    var t = pref;
    if (t === "auto")
      t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    if (!BG[t]) t = "light";
    root.setAttribute("data-theme", t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", BG[t]);
  } catch (e) {}
})();
