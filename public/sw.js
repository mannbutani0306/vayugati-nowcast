const CACHE_NAME = 'vayugati-shell-v5';
const SHELL_URLS = ['/', '/manifest.json', '/icons/logo.png?v=2'];
const DATABASE_NAME = 'vayugati-offline-data';
const DATABASE_VERSION = 1;
const WARNING_KEY = 'active-alerts';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('warnings')) {
        request.result.createObjectStore('warnings');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeWarnings(payload) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('warnings', 'readwrite');
    transaction.objectStore('warnings').put(payload, WARNING_KEY);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

async function readWarnings() {
  const database = await openDatabase();
  const payload = await new Promise((resolve, reject) => {
    const request = database.transaction('warnings', 'readonly').objectStore('warnings').get(WARNING_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return payload;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const shellResponse = await fetch('/');
      if (!shellResponse.ok) throw new Error('App shell could not be cached.');
      const shellMarkup = await shellResponse.clone().text();
      await cache.put('/', shellResponse);
      const referencedAssets = Array.from(shellMarkup.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi))
        .map((match) => match[1])
        .filter((assetUrl) => assetUrl.startsWith('/'));
      await cache.addAll([...SHELL_URLS.filter((url) => url !== '/'), ...referencedAssets]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('vayugati-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CACHE_ACTIVE_ALERTS' && event.data.payload) {
    event.waitUntil(storeWarnings(event.data.payload));
  }
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname === '/__offline/active-alerts.json') {
    event.respondWith(
      readWarnings()
        .then((payload) => new Response(JSON.stringify(payload || { alerts: [], timestamp: null }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        }))
        .catch(() => new Response(JSON.stringify({ alerts: [], timestamp: null }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        })),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) await caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/')) || Response.error()),
    );
    return;
  }

  if (['script', 'style', 'font', 'image', 'manifest'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then(async (response) => {
        if (response.ok) await caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      })),
    );
  }
});

self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data?.json() || {};
  } catch {
    message = { body: event.data?.text() || '' };
  }
  const title = message.title || 'Approved weather alert';
  const options = {
    body: message.body || message.headline || 'Open the Citizen Portal for the latest approved warning.',
    icon: '/icons/logo.png?v=2',
    badge: '/icons/logo.png?v=2',
    tag: message.alertId || message.identifier || 'vayugati-approved-alert',
    renotify: true,
    requireInteraction: true,
    data: { url: message.url || '/citizen' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/citizen', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.navigate(target);
        return existing.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});