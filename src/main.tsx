import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// @ts-ignore
import { registerSW } from 'virtual:pwa-register';

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
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).deferredPWAInstallPrompt = e;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
