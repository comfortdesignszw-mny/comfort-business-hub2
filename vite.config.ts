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
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.png', 'manifest.json', 'icons/*.png', 'icons/*.ico'],
        manifest: {
          name: 'Comfort Business Hub',
          short_name: 'ComfortHub',
          description: 'Fortress-grade Supply Node & Marketplace Matrix for the Modern Economy',
          theme_color: '#f8fafc',
          background_color: '#f8fafc',
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
              url: '/deals',
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
          globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff,woff2,json,manifest}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
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
    build: {
      target: 'esnext',
      cssCodeSplit: true,
      minify: 'esbuild',
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                return 'vendor-react';
              }
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('motion')) {
                return 'vendor-motion';
              }
              if (id.includes('leaflet') || id.includes('react-leaflet')) {
                return 'vendor-maps';
              }
              if (id.includes('recharts')) {
                return 'vendor-charts';
              }
            }
          }
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
