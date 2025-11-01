const CACHE_NAME = 'sketch-ui-cache-v1';
const ORIGIN = self.location.origin;
const OPENCV_SOURCES = [
  `${ORIGIN}/libs/opencv.js`,
  'https://cdn.jsdelivr.net/npm/opencv.js@4.10.0/opencv.js',
  'https://unpkg.com/opencv.js@4.10.0/opencv.js',
  'https://docs.opencv.org/4.x/opencv.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(OPENCV_SOURCES[0]).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;
  if (OPENCV_SOURCES.includes(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(url);
        if (cached) {
          return cached;
        }
        const response = await fetch(request);
        if (response && response.ok) {
          cache.put(url, response.clone());
        }
        return response;
      }).catch(() => fetch(request))
    );
  }
});
