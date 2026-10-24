// FOUC এড়াতে pre-hydration থিম-script (Arch §১১) — external ফাইল, তাই CSP `script-src 'self'`-এই চলে।
// পছন্দ: localStorage 'theme' → নইলে DEFAULT_THEME (= siteSettings.defaultTheme; build-সময়ে scripts/build-theme-default.ts বসায়)।
// bg-মান tokens.css-এর --bg-র সাথে মিলিয়ে রাখতে হবে (theme-color meta-র জন্য)।
(function () {
  var DEFAULT_THEME = "light";
  // siteSettings.design — build-সময়ে scripts/build-theme-default.ts বসায় (P9b-১); শুধু পাবলিক সাইটে প্রযোজ্য
  var DESIGN = { palette: "classic", accent: "terracotta", font: "serif-sans", card: "outline" };
  var BG = {
    light: "#faf9f5",
    sepia: "#f4ecd8",
    warm: "#f7e8d0",
    dark: "#1c1b19",
    amoled: "#000000",
  };
  // প্যালেটের bg (শুধু light/dark) — tokens.css ও src/lib/design.ts-এর PALETTE_BG-র সাথে মেলাতে হবে (design.test.ts মেলায়)
  var PBG = {
    slate: { light: "#f6f5ee", dark: "#171b14" },
    oyster: { light: "#eeece6", dark: "#1d1c1a" },
    midnight: { light: "#f5f2ea", dark: "#0f1a2b" },
    paper: { light: "#fcfcfa", dark: "#121212" },
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
    // প্যালেট ড্যাশবোর্ডসহ সব পথে (রং একই থাকে); classic = কোনো ওভাররাইড নেই
    var pal = PBG[DESIGN.palette] ? DESIGN.palette : "classic";
    root.setAttribute("data-palette", pal);
    if (!/^\/(dashboard|login|share)(\/|$)/.test(location.pathname)) {
      root.setAttribute("data-accent", DESIGN.accent);
      root.setAttribute("data-font", DESIGN.font);
      root.setAttribute("data-card", DESIGN.card);
      // P10b-২: পাঠকের লেখার-আকার (s|m|l; অবৈধ → m)
      var rs = null;
      try {
        rs = localStorage.getItem("readerSize");
      } catch (e) {}
      root.setAttribute("data-rsize", rs === "s" || rs === "l" ? rs : "m");
      // P12-১: পাঠকের ফন্ট (allowlist = src/lib/fonts.ts-এর FONT_IDS; fonts.test.ts মেলায়); খালি/অবৈধ → সাইটের ফন্ট
      var rf = null;
      try {
        rf = localStorage.getItem("readerFont");
      } catch (e) {}
      var RFONTS = ["serif", "sans", "hind", "solaiman", "kalpurush", "inter", "roboto"];
      if (rf && RFONTS.indexOf(rf) > -1) root.setAttribute("data-rfont", rf);
    }
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", (PBG[pal] && PBG[pal][t]) || BG[t]);
  } catch (e) {}
})();
