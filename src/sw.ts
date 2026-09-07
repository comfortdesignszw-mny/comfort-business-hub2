/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { clientsClaim } from 'workbox-core';

// Ensure new deployments take effect immediately across Cloudflare Pages & browsers
self.skipWaiting();
clientsClaim();

const SHELL_CACHE_NAME = 'comfort-app-shell-v3';

// Listen for explicit SW control messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Precache static assets compiled by Vite
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// 1. Explicitly precache app shell on service worker install to guarantee offline boot
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll([
          '/',
          '/index.html',
          '/manifest.json',
          '/favicon.ico',
          '/icon.png'
        ]);
      } catch (err) {
        console.warn('[SW] App shell initial cache note:', err);
      }
    })
  );
});

// 2. Unconditional Zero-Connection Navigation Route:
// Intercepts ANY page navigation (/, /discovery, /chat, /stores, /deals, /profile, /?source=pwa).
// Serves cached index.html immediately with ZERO HTTP handshake and ZERO dependence on online status.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ request }) => {
    // A. Check Workbox precache first (try both 'index.html' and '/index.html')
    try {
      const precached = (await matchPrecache('index.html')) || (await matchPrecache('/index.html'));
      if (precached) return precached;
    } catch (e) {}

    // B. Check dedicated app shell cache & all active caches
    try {
      const cached = (await caches.match('/index.html')) ||
                     (await caches.match('index.html')) ||
                     (await caches.match('/'));
      if (cached) return cached;
    } catch (e) {}

    // C. If online, fetch from network and dynamically store in shell cache for offline restart
    try {
      const response = await fetch(request);
      if (response && response.status === 200) {
        const cache = await caches.open(SHELL_CACHE_NAME);
        cache.put('/index.html', response.clone());
        cache.put('/', response.clone());
      }
      return response;
    } catch (fetchErr) {
      // D. Network failed (offline) - try any cached HTML response
      const fallback = (await caches.match('/index.html')) ||
                       (await caches.match('index.html')) ||
                       (await caches.match('/'));
      if (fallback) return fallback;
      throw fetchErr;
    }
  }
);

// Cache static scripts, styles, and web workers using CacheFirst to ensure immediate startup with zero HTTP handshake
registerRoute(
  ({ request, url }) => 
    request.destination === 'script' || 
    request.destination === 'style' || 
    request.destination === 'worker' ||
    url.pathname.startsWith('/assets/'),
  new CacheFirst({
    cacheName: 'app-static-code-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 150,
        maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
      })
    ]
  })
);

// Cache Google Fonts
registerRoute(
  /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
      })
    ]
  })
);

// Firebase Storage / Unsplash / External Images caching
registerRoute(
  /^https:\/\/(firebasestorage\.googleapis\.com|images\.unsplash\.com)\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'media-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
      })
    ]
  })
);

// Offline Fallback for missing resources and zero-connection navigation
setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    const cachedIndex = (await matchPrecache('index.html')) ||
                        (await matchPrecache('/index.html')) ||
                        (await caches.match('/index.html')) || 
                        (await caches.match('index.html')) || 
                        (await caches.match('/'));
    if (cachedIndex) return cachedIndex;
  }
  if (request.destination === 'image') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="100%" height="100%" fill="#0d1117"/>
      <path d="M70 120 L95 90 L120 120 L135 105 L160 135 L40 135 Z" fill="#21262d"/>
      <circle cx="75" cy="75" r="12" fill="#30363d"/>
      <text x="50%" y="85%" font-family="sans-serif" font-weight="bold" font-size="11" fill="#8b949e" text-anchor="middle">OFFLINE ASSET</text>
    </svg>`;
    return new Response(svg, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' }
    });
  }
  return Response.error();
});

// Push Notifications
self.addEventListener('push', (event) => {
  let data = { title: 'New Alert', body: 'You have a new update.', url: '/', type: 'general', priority: 'normal' };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options: any = {
    body: data.body,
    icon: '/icon.png',
    badge: '/icon.png',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
  };

  if (data.priority === 'high') {
    options.requireInteraction = true;
    options.actions = [];
    
    if (data.type === 'message') {
      options.actions.push({ action: 'reply', title: 'Reply' });
      options.data.url = '/chat';
    } else if (data.type === 'order') {
      options.actions.push({ action: 'view_order', title: 'View Order' });
      options.data.url = '/orders';
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-data-mutations' || event.tag === 'sync-image-upload') {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SYNC_TRIGGERED', tag: event.tag }));
      })
    );
  }
});
