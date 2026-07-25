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
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        manifestFilename: 'manifest.json',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'manifest.json', 'icons/*.png', 'icons/*.ico'],
        manifest: {
          name: 'Comfort Business Hub',
          short_name: 'ComfortHub',
          description: 'Fortress-grade Supply Node & Marketplace Matrix for the Modern Economy',
          theme_color: '#0d1117',
          background_color: '#05070a',
          display: 'standalone',
          display_override: ['standalone', 'window-controls-overlay', "minimal-ui"],
          orientation: 'any',
          start_url: '/?source=pwa',
          scope: '/',
          categories: ['business', 'productivity', 'utilities'],
          prefer_related_applications: false,
          shortcuts: [
            {
              name: 'Explore Matrix',
              short_name: 'Explore',
              description: 'Access the global supply network',
              url: '/discovery',
              icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }]
            },
            {
              name: 'Orders & Deals',
              short_name: 'Orders',
              description: 'View active deal rooms',
              url: '/chat',
              icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }]
            }
          ],
          icons: [
            {
              src: '/icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/icon-maskable-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: '/icons/icon-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
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
