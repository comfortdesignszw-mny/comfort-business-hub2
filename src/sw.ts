/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { clientsClaim } from 'workbox-core';

// Ensure new deployments take effect immediately across Cloudflare Pages & browsers
self.skipWaiting();
clientsClaim();

// Listen for explicit SW control messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Precache static assets compiled by Vite
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA Navigation Handler:
// Guarantees that ANY page load or route navigation (e.g., /, /discovery, /chat, /profile, /stores, /?source=pwa)
// immediately serves precached index.html when offline or online without waiting for network delays, enabling zero-connection app launch.
const navigationHandler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [
    /^\/api\/.*/,
    /^\/__/,
    /\.[a-zA-Z0-9]+$/ // Do not intercept direct asset files with extension (e.g., .png, .css, .js)
  ]
});
registerRoute(navigationRoute);

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

// Offline Fallback for missing resources
setCatchHandler(async ({ request }) => {
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
