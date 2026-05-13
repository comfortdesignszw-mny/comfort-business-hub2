import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'Comfort Business Hub',
          short_name: 'ComfortHub',
          description: 'Fortress-grade Supply Node & Marketplace Matrix',
          theme_color: '#05070a',
          background_color: '#05070a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          categories: ['business', 'shopping', 'productivity'],
          shortcuts: [
            {
              name: 'Explore Matrix',
              short_name: 'Explore',
              description: 'Access the global supply network',
              url: '/discovery',
              icons: [{ src: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=96&h=96&q=80&fit=crop', sizes: '96x96' }]
            },
            {
              name: 'Orders & Deals',
              short_name: 'Orders',
              description: 'View active deal rooms',
              url: '/chat',
              icons: [{ src: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=96&h=96&q=80&fit=crop', sizes: '96x96' }]
            }
          ],
          screenshots: [
            {
              src: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1080&h=1920&q=80&fit=crop',
              sizes: '1080x1920',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Neural Marketplace'
            },
            {
              src: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&h=1080&q=80&fit=crop',
              sizes: '1920x1080',
              type: 'image/png',
              form_factor: 'wide',
              label: 'Supply Chain Command'
            }
          ],
          icons: [
            {
              src: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=192&h=192&q=80&fit=crop',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=512&h=512&q=80&fit=crop',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          cleanupOutdatedCaches: true,
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                }
              }
            },
            {
              urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'firebase-assets',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                }
              }
            },
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'product-images',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30
                }
              }
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
