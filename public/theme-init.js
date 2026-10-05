// FOUC এড়াতে pre-hydration থিম-script (Arch §১১) — external ফাইল, তাই CSP `script-src 'self'`-এই চলে।
// পছন্দ: localStorage 'theme' → নইলে DEFAULT_THEME (= siteSettings.defaultTheme; build-সময়ে scripts/build-theme-default.ts বসায়)।
// bg-মান tokens.css-এর --bg-র সাথে মিলিয়ে রাখতে হবে (theme-color meta-র জন্য)।
(function () {
  var DEFAULT_THEME = "light";
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
    root.setAttribute("data-default-theme", DEFAULT_THEME); // dashboard-এর picker এটা পড়ে (comfortStore)
    if (!pref) pref = DEFAULT_THEME;
    var t = pref;
    if (t === "auto")
      t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    if (!BG[t]) t = "light";
    root.setAttribute("data-theme", t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", BG[t]);
  } catch (e) {}
})();
