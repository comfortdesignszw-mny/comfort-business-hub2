import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { localDataRepository } from './lib/localDataRepository';
import { processOutboxSync } from './lib/dexieSyncManager';
// @ts-ignore
import { registerSW } from 'virtual:pwa-register';

// Non-blocking initialization sequence
function initializeLocalServices() {
  // Fire-and-forget local DB seed & offline service initialization
  localDataRepository.seedInitialDataIfNeeded().then(() => {
    console.log('[Bootstrap] Local IndexedDB seed check complete.');
  }).catch((err) => {
    console.warn('[Bootstrap] Local DB seed non-fatal warning:', err);
  });

  // Background outbox sync if online
  if (typeof window !== 'undefined' && navigator.onLine) {
    processOutboxSync().catch((err) => {
      console.warn('[Bootstrap] Background outbox sync deferred:', err);
    });
  }
}

// Execute non-blocking services initialization
initializeLocalServices();

// Register PWA service worker with auto-update configuration
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New version detected on server. Activating update...');
    updateSW(true);
  },
  onRegisteredSW(swUrl, registration) {
    console.log('[PWA] Service Worker registered:', swUrl);
    if (registration) {
      // Periodically check for new Cloudflare Pages deployments
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // Every hour
    }
  },
  onOfflineReady() {
    console.log('[PWA] App is ready to work offline.');
  }
});

// Auto-reload active clients when a newly deployed service worker takes control
let refreshing = false;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing && navigator.serviceWorker.controller && navigator.onLine) {
      refreshing = true;
      console.log('[PWA] New deployment active. Refreshing application...');
      window.location.reload();
    }
  });
}

// Capture install prompt early
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as any).deferredPWAInstallPrompt = e;
  });
}

// CRITICAL REQUIREMENT: Render app shell IMMEDIATELY without awaiting network/auth
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

