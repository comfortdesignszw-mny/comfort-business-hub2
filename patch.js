const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');
code = code.replace(/name: 'Comfort Business Hub',[\s\S]*icons: \[\s*{[\s\S]*?}\s*\]\s*}/, `name: 'Comfort Business Hub',
          short_name: 'ComfortHub',
          description: 'Manage your business, messaging, products, and sales seamlessly offline and online.',
          theme_color: '#000000',
          background_color: '#FFFFFF',
          display: 'standalone',
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
              icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }]
            },
            {
              name: 'Orders & Deals',
              short_name: 'Orders',
              description: 'View active deal rooms',
              url: '/chat',
              icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }]
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
        }`);
fs.writeFileSync('vite.config.ts', code);
