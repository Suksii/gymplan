/* Offline support: page shell is cached; network is tried first so updates arrive. */
var CACHE = "snaga-masa-__VER__";
var SHELL = ["./", "manifest.webmanifest", "icon-192.png", "icon-180.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  // video is fetched in byte ranges, which the cache cannot store: leave it to the browser (offline the app falls back to the drawing)
  if (e.request.headers.has("range") || /\.mp4(\?|$)/.test(e.request.url)) return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && (res.ok || res.type === "opaque")) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (hit) { return hit || (e.request.mode === "navigate" ? caches.match("./") : Response.error()); });
    })
  );
});
