const CACHE_NAME = 'sketch-ui-cache-v2';
const ORIGIN = self.location.origin;

const RESOURCE_CONFIG = [
  {
    primary: `${ORIGIN}/libs/opencv.js`,
    fallbacks: [
      'https://cdn.jsdelivr.net/npm/opencv.js@4.10.0/opencv.js',
      'https://unpkg.com/opencv.js@4.10.0/opencv.js',
      'https://docs.opencv.org/4.x/opencv.js'
    ]
  },
  {
    primary: `${ORIGIN}/libs/opencv_js.wasm`,
    fallbacks: [
      'https://cdn.jsdelivr.net/npm/opencv.js@4.10.0/opencv_js.wasm',
      'https://unpkg.com/opencv.js@4.10.0/opencv_js.wasm',
      'https://docs.opencv.org/4.x/opencv_js.wasm'
    ]
  }
];

const RESOURCE_LOOKUP = new Map();
for (const resource of RESOURCE_CONFIG) {
  const urls = [resource.primary, ...resource.fallbacks];
  resource.urls = new Set(urls);
  urls.forEach((url) => RESOURCE_LOOKUP.set(url, resource));
}

async function cacheWithFallbacks(cache, resource) {
  const candidates = [resource.primary, ...resource.fallbacks];
  for (const url of candidates) {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response || !response.ok) {
        continue;
      }
      const primaryClone = response.clone();
      await cache.put(resource.primary, primaryClone);
      if (url !== resource.primary) {
        await cache.put(url, response.clone());
      }
      return;
    } catch (_) {
      // Try next candidate.
    }
  }
}

async function respondWithCache(event, resource) {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const candidates = [request.url];
  if (request.url !== resource.primary) {
    candidates.push(resource.primary);
  }
  for (const url of resource.fallbacks) {
    if (!candidates.includes(url)) {
      candidates.push(url);
    }
  }
  for (const url of candidates) {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response || !response.ok) {
        continue;
      }
      await cache.put(request, response.clone());
      if (url !== request.url) {
        await cache.put(url, response.clone());
      }
      return response;
    } catch (_) {
      // Try next candidate.
    }
  }

  return fetch(request);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        for (const resource of RESOURCE_CONFIG) {
          await cacheWithFallbacks(cache, resource);
        }
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;
  const resource = RESOURCE_LOOKUP.get(url);
  if (resource) {
    event.respondWith(respondWithCache(event, resource));
  }
});
