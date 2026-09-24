/* Zaytung Zone – ağır statik dosyalar (3D modeller, model-viewer, görseller) için önbellek.

   GitHub Pages her dosyaya "Cache-Control: max-age=600" gönderir ve _headers dosyasını
   uygulamaz; tarayıcının HTTP önbelleği de büyük dosyaları kolayca siler. Bu yüzden
   4-5 MB'lık modeller her ziyarette yeniden inebiliyordu.

   Strateji: önbellekte varsa anında oradan ver (cache-first), arka planda ETag ile
   küçük bir "değişti mi?" sorgusu at (304 ise hiçbir şey inmez). Dosya sunucuda
   değişmişse yeni sürüm önbelleğe yazılır, bir sonraki açılışta kullanılır.
   HTML / JS / CSS / menü verisi bu SW'den geçmez, her zaman ağdan taze gelir. */

const CACHE = "zz-assets-v1";
const CACHED_PATHS = /\/(models|vendor|images)\//;

const inflight = new Map();
const revalidated = new Set();

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("zz-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !CACHED_PATHS.test(url.pathname)) return;
  event.respondWith(cacheFirst(url.href, event));
});

async function cacheFirst(key, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(key);
  if (cached) {
    if (!revalidated.has(key)) {
      revalidated.add(key);
      event.waitUntil(revalidate(cache, key, cached).catch(() => {}));
    }
    return cached;
  }
  return fetchAndStore(cache, key, event);
}

// Aynı dosya için eşzamanlı istekleri tek indirmeye indir
function fetchAndStore(cache, key, event) {
  if (!inflight.has(key)) {
    const pending = fetch(key).then((response) => {
      if (response.status === 200) event.waitUntil(cache.put(key, response.clone()));
      return response;
    });
    inflight.set(key, pending);
    pending.finally(() => inflight.delete(key)).catch(() => {});
  }
  return inflight.get(key).then((response) => response.clone());
}

async function revalidate(cache, key, cached) {
  const etag = cached.headers.get("etag");
  const lastModified = cached.headers.get("last-modified");
  if (!etag && !lastModified) return;
  const headers = {};
  if (etag) headers["If-None-Match"] = etag;
  if (lastModified) headers["If-Modified-Since"] = lastModified;
  const response = await fetch(key, { headers, cache: "no-store" });
  if (response.status === 200) await cache.put(key, response);
}
