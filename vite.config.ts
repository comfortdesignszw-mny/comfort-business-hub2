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
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'Comfort Business Hub',
          short_name: 'ComfortHub',
          description: 'Neural Supply Chain & Marketplace Matrix for the Modern Zimbabwe Economy',
          theme_color: '#05070a',
          background_color: '#05070a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          categories: ['business', 'shopping', 'productivity'],
          prefer_related_applications: false,
          shortcuts: [
            {
              name: 'Explore Matrix',
              short_name: 'Explore',
              description: 'Access the global supply network',
              url: '/discovery',
              icons: [{ src: '/icon.png', sizes: '96x96' }]
            },
            {
              name: 'Orders & Deals',
              short_name: 'Orders',
              description: 'View active deal rooms',
              url: '/chat',
              icons: [{ src: '/icon.png', sizes: '96x96' }]
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
              src: '/icon.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icon.png',
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
