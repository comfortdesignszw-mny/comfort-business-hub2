import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  let vite: any = null;

  app.use(express.json());

  // Initialize Gemini only if key is present
  let ai: GoogleGenAI | null = null;
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }

  // API Route for WhatsApp Parsing
  app.post('/api/import/whatsapp', async (req, res) => {
    try {
      if (!ai) {
        return res.status(503).json({ 
          error: 'Gemini API is not configured. To use the WhatsApp Scanner, please add your GEMINI_API_KEY to the "Secrets" panel in the AI Studio Settings menu.' 
        });
      }

      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      console.log('Attempting to parse WhatsApp catalogue:', url);

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the WhatsApp Business Catalogue link: ${url}. 
        Extract a list of products with their names, descriptions, prices, and currencies.
        If image URLs are present in the catalogue content, include them. 
        Focus on providing a structured list of inventory items.`,
        config: {
          tools: [{ urlContext: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              products: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    price: { type: Type.NUMBER },
                    currency: { type: Type.STRING, description: "e.g. USD, ZiG" },
                    image: { type: Type.STRING }
                  },
                  required: ['name', 'price', 'currency']
                }
              }
            }
          }
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('No data extracted from the link.');
      }

      const data = JSON.parse(text);
      res.json(data);
    } catch (error: any) {
      console.error('WhatsApp Import error:', error);
      res.status(500).json({ error: error.message || 'Failed to process the URL.' });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', api_configured: !!ai });
  });

  function parseFirestoreField(field: any): any {
    if (!field) return undefined;
    if ('stringValue' in field) return field.stringValue;
    if ('doubleValue' in field) return Number(field.doubleValue);
    if ('integerValue' in field) return Number(field.integerValue);
    if ('booleanValue' in field) return field.booleanValue;
    if ('arrayValue' in field) {
      const values = field.arrayValue.values || [];
      return values.map((v: any) => parseFirestoreField(v));
    }
    if ('mapValue' in field) {
      const fields = field.mapValue.fields || {};
      const obj: any = {};
      for (const k of Object.keys(fields)) {
        obj[k] = parseFirestoreField(fields[k]);
      }
      return obj;
    }
    return undefined;
  }

  function parseFirestoreDoc(doc: any): any {
    if (!doc || !doc.fields) return null;
    const result: any = {};
    for (const key of Object.keys(doc.fields)) {
      result[key] = parseFirestoreField(doc.fields[key]);
    }
    return result;
  }

  async function fetchFirestoreDocument(collection: string, id: string): Promise<any> {
    const projectId = "gen-lang-client-0045594701";
    const databaseId = "ai-studio-8691367b-abd4-4f01-8572-65d212fbad17";
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collection}/${id}`;
    
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Firestore document fetch failed for ${collection}/${id}: Status ${res.status}`);
        return null;
      }
      const data = await res.json();
      return parseFirestoreDoc(data);
    } catch (err) {
      console.error(`Error fetching Firestore document ${collection}/${id}:`, err);
      return null;
    }
  }

  function injectMetaTags(html: string, data: { title: string, description: string, image: string, url: string }) {
    let transformed = html.replace(/<title>[^]*?<\/title>/, `<title>${data.title}</title>`);
    transformed = transformed.replace(/<meta name="description" content="[^]*?"\s*\/?>/, `<meta name="description" content="${data.description}" />`);
    transformed = transformed.replace(/<meta property="og:title" content="[^]*?"\s*\/?>/, `<meta property="og:title" content="${data.title}">`);
    transformed = transformed.replace(/<meta property="og:description" content="[^]*?"\s*\/?>/, `<meta property="og:description" content="${data.description}">`);
    transformed = transformed.replace(/<meta property="og:image" content="[^]*?"\s*\/?>/, `<meta property="og:image" content="${data.image}">`);
    transformed = transformed.replace(/<meta property="twitter:image" content="[^]*?"\s*\/?>/, `<meta property="twitter:image" content="${data.image}">`);
    
    const ogUrlTag = `<meta property="og:url" content="${data.url}">`;
    transformed = transformed.replace('</head>', `${ogUrlTag}\n</head>`);
    
    return transformed;
  }

  async function getBaseHtml(viteInstance?: any, originalUrl?: string): Promise<string> {
    const indexPath = process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), 'dist', 'index.html')
      : path.join(process.cwd(), 'index.html');
    try {
      let rawHtml = await fs.promises.readFile(indexPath, 'utf-8');
      if (process.env.NODE_ENV !== 'production' && viteInstance && originalUrl) {
        rawHtml = await viteInstance.transformIndexHtml(originalUrl, rawHtml);
      }
      return rawHtml;
    } catch (err) {
      console.error('Error reading index.html:', err);
      return `<!DOCTYPE html><html><head><title>Comfort Business Hub</title></head><body><div id="root"></div></body></html>`;
    }
  }

  // Dynamic Open Graph / SEO Preview injection for social sharing bots
  app.get(['/', '/product/:id', '/store/:id', '/profile/:id'], async (req, res, next) => {
    if (req.path.includes('.') || req.path.startsWith('/@') || req.path.startsWith('/src')) {
      return next();
    }
    
    try {
      const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const itemId = req.params.id;
      let title = "Comfort Business Hub | Neural Supply Chain";
      let desc = "Fortress-grade Supply Node & Marketplace Matrix for the Modern Zimbabwe Economy";
      let image = `${req.protocol}://${req.get('host')}/icon.png`;

      if (req.path.startsWith('/product/') && itemId) {
        const product = await fetchFirestoreDocument('products', itemId);
        if (product) {
          title = product.name;
          desc = product.description || `Check out ${product.name} on Comfort Business Hub!`;
          if (product.images && product.images.length > 0) {
            image = product.images[0];
          }
          if (product.storeId) {
            const store = await fetchFirestoreDocument('stores', product.storeId);
            if (store) {
              title = `${product.name} | ${store.name}`;
              desc = `${product.description || desc} • Available at ${store.name} / Comfort Business Hub`;
            }
          }
        }
      } else if (req.path.startsWith('/store/') && itemId) {
        const store = await fetchFirestoreDocument('stores', itemId);
        if (store) {
          title = `${store.name} | Comfort Business Hub`;
          desc = store.description || `Access ${store.name}'s supply inventory and establish direct business partnerships.`;
          image = store.logo || store.banner || image;
        }
      } else if (req.path.startsWith('/profile/') && itemId) {
        let profileData = await fetchFirestoreDocument('public_profiles', itemId);
        if (!profileData) {
          profileData = await fetchFirestoreDocument('users', itemId);
        }
        if (profileData) {
          const roleLabel = profileData.currentRole === 'supplier' ? 'Supplier Node' : 'Network Member';
          title = `${profileData.name} (${roleLabel}) | Comfort Business Hub`;
          desc = `Establish direct comms and mutual supply lines. Node footprint: ${profileData.uid?.slice(0, 8)}. Powered by Comfort Business Hub.`;
          image = profileData.avatar || image;
        }
      }

      const baseHtml = await getBaseHtml(vite, req.originalUrl);
      const transformedHtml = injectMetaTags(baseHtml, {
        title,
        description: desc,
        image,
        url: fullUrl
      });

      return res.setHeader('Content-Type', 'text/html').send(transformedHtml);
    } catch (err) {
      console.error("Failed to inject OG meta tags:", err);
      next();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
