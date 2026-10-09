/* Service Worker cache-নীতি (P7b-৩, Arch §১২) — pure; sw.js (importScripts) ও unit-test দুই জায়গায় একই ফাইল।
   মূলনীতি: private/dashboard ডেটা কখনো SW-cache-এ যাবে না। নতুন private route (যেমন P11c share-link পেজ) হলে PRIVATE-এ যোগ করুন। */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SWP = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var VERSION = "v1";
  var CACHES = { static: "am-" + VERSION + "-static", pages: "am-" + VERSION + "-pages" };
  var PAGE_LIMIT = 50;
  var STATIC_LIMIT = 120;
  var NET_TIMEOUT_MS = 3000;
  var OFFLINE_URL = "/offline";
  // NetworkOnly: SW এসব রিকোয়েস্টে হাতই দেয় না
  var PRIVATE = ["/dashboard", "/login", "/api", "/build.json", "/sw.js", "/sw-policy.js", "/share"];

  function norm(p) {
    try { p = decodeURIComponent(p); } catch (e) { /* যেমন আছে */ }
    return p.toLowerCase();
  }
  function isPrivatePath(path) {
    var p = norm(path);
    for (var i = 0; i < PRIVATE.length; i++) {
      var x = PRIVATE[i];
      if (p === x || p.indexOf(x + "/") === 0) return true;
    }
    return false;
  }
  /** req: {method, mode, url}; ফল: 'static' | 'asset' | 'page' | 'none' */
  function classify(req, origin) {
    if (req.method !== "GET") return "none";
    var u;
    try { u = new URL(req.url); } catch (e) { return "none"; }
    if (u.origin !== origin) return "none";
    if (isPrivatePath(u.pathname)) return "none";
    var p = u.pathname;
    if (p.indexOf("/_next/static/") === 0) return "static";
    if (p.indexOf("/icons/") === 0 || p === "/theme-init.js") return "asset";
    if (req.mode === "navigate") return "page";
    return "none";
  }
  /** res: Response-এর মতো {status,type,redirected,headers.get} */
  function isCacheableResponse(res) {
    if (!res || res.status !== 200 || res.type !== "basic" || res.redirected) return false;
    var cc = (res.headers && res.headers.get && res.headers.get("Cache-Control")) || "";
    return !/no-store|private/i.test(cc);
  }
  return {
    VERSION: VERSION, CACHES: CACHES, PAGE_LIMIT: PAGE_LIMIT, STATIC_LIMIT: STATIC_LIMIT,
    NET_TIMEOUT_MS: NET_TIMEOUT_MS, OFFLINE_URL: OFFLINE_URL, PRIVATE: PRIVATE,
    isPrivatePath: isPrivatePath, classify: classify, isCacheableResponse: isCacheableResponse,
  };
});
