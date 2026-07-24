/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
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

// Precache static assets
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Background Sync for standard fetch requests (if any)
const bgSyncPlugin = new BackgroundSyncPlugin('comfort-queue', {
  maxRetentionTime: 24 * 60 // Retry for max of 24 Hours
});

// Cache google fonts
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365
      })
    ]
  })
);

// Firebase Storage / Unsplash caching
registerRoute(
  /^https:\/\/(firebasestorage\.googleapis\.com|images\.unsplash\.com)\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'media-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 150,
        maxAgeSeconds: 60 * 60 * 24 * 30
      })
    ]
  })
);

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

  // High Priority specific handling
  if (data.priority === 'high') {
    options.requireInteraction = true; // Keep visible until user acts
    options.actions = [];
    
    // Actionable buttons
    if (data.type === 'message') {
      options.actions.push({ action: 'reply', title: 'Reply' });
      options.data.url = '/chat';
    } else if (data.type === 'order') {
      options.actions.push({ action: 'view_order', title: 'View Order' });
      options.data.url = '/orders'; // or relevant route
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
      // Check if there is already a window/tab open with the target URL
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
