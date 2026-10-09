/* জরুরি কিল-সুইচ: SW-এ সমস্যা হলে এই ফাইলের লেখা দিয়ে public/sw.js প্রতিস্থাপন করে commit+deploy করুন।
   ব্রাউজার পরের বার sw.js আনলে (no-cache) এটি সব cache মুছে নিজেকে unregister করে। */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (ns) { return Promise.all(ns.filter(function (n) { return n.indexOf("am-") === 0; }).map(function (n) { return caches.delete(n); })); })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: "window" }); })
      .then(function (cs) { cs.forEach(function (c) { c.navigate(c.url); }); }),
  );
});
