/* Service Worker (P7b-৩): শুধু পাবলিক static asset ও পাবলিক পেজ cache; /dashboard,/api,/login ইত্যাদি NetworkOnly (নীতি: sw-policy.js)।
   skipWaiting নেই — নতুন SW সব ট্যাব বন্ধ হলে সক্রিয় হয়। জরুরি বন্ধ: scripts/sw-kill.js এই ফাইলের জায়গায় বসানো (README)। */
importScripts("/sw-policy.js");
var P = self.SWP;

self.addEventListener("install", function (event) {
  // /offline আগেই cache; না পেলেও install ব্যর্থ নয়
  event.waitUntil(
    caches.open(P.CACHES.pages).then(function (c) {
      return c.add(new Request(P.OFFLINE_URL, { cache: "reload" })).catch(function () {});
    }),
  );
});

self.addEventListener("activate", function (event) {
  var keep = [P.CACHES.static, P.CACHES.pages];
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n.indexOf("am-") === 0 && keep.indexOf(n) < 0; })
          .map(function (n) { return caches.delete(n); }),
      );
    }),
  );
});

function trim(name, max) {
  return caches.open(name).then(function (c) {
    return c.keys().then(function (ks) {
      var extra = ks.length - max;
      return extra > 0 ? Promise.all(ks.slice(0, extra).map(function (k) { return c.delete(k); })) : null;
    });
  });
}
function store(name, max, req, res) {
  return caches.open(name).then(function (c) { return c.put(req, res); }).then(function () { return trim(name, max); });
}

function cacheFirst(event) {
  return caches.match(event.request).then(function (hit) {
    if (hit) return hit;
    return fetch(event.request).then(function (res) {
      if (P.isCacheableResponse(res)) event.waitUntil(store(P.CACHES.static, P.STATIC_LIMIT, event.request, res.clone()).catch(function () {}));
      return res;
    });
  });
}
function staleWhileRevalidate(event) {
  return caches.match(event.request).then(function (hit) {
    var net = fetch(event.request).then(function (res) {
      if (P.isCacheableResponse(res)) event.waitUntil(store(P.CACHES.static, P.STATIC_LIMIT, event.request, res.clone()).catch(function () {}));
      return res;
    });
    if (hit) { net.catch(function () {}); return hit; }
    return net;
  });
}
function networkFirstPage(event) {
  var req = event.request;
  var net = fetch(req).then(function (res) {
    if (P.isCacheableResponse(res)) event.waitUntil(store(P.CACHES.pages, P.PAGE_LIMIT, req, res.clone()).catch(function () {}));
    return res;
  });
  var timeout = new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, P.NET_TIMEOUT_MS); });
  return Promise.race([net, timeout]).catch(function () {
    return caches.match(req).then(function (hit) {
      if (hit) { net.catch(function () {}); return hit; }
      // timeout হলেও নেট শেষে আসতে পারে
      return net.catch(function () {
        return caches.match(P.OFFLINE_URL).then(function (off) { return off || Response.error(); });
      });
    });
  });
}

self.addEventListener("fetch", function (event) {
  var kind = P.classify(event.request, self.location.origin);
  if (kind === "static") event.respondWith(cacheFirst(event));
  else if (kind === "asset") event.respondWith(staleWhileRevalidate(event));
  else if (kind === "page") event.respondWith(networkFirstPage(event));
  // 'none' → respondWith নেই = NetworkOnly
});
