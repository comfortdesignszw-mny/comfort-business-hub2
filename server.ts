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

  // Enable trust proxy for horizontal load balancing behind Cloud Run & nginx proxies
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Performance and security middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  // High-availability health & readiness probes for load balancers
  app.get(['/healthz', '/readyz', '/api/health'], (req, res) => {
    res.status(200).json({
      status: 'healthy',
      ready: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      api_configured: !!ai
    });
  });
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

  // Helper function to call Gemini with retry and model fallback
  async function generateContentWithRetry(params: any) {
    if (!ai) throw new Error('Gemini AI client is not initialized');
    
    // Primary model according to guidelines: gemini-3.6-flash
    const models = ['gemini-3.6-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let lastError: any = null;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`Calling Gemini model ${model} (attempt ${attempt + 1})...`);
          const response = await ai.models.generateContent({
            ...params,
            model,
          });
          if (response && response.text) {
            return response;
          }
        } catch (err: any) {
          console.warn(`Gemini call to ${model} failed (attempt ${attempt + 1}):`, err?.message || err);
          lastError = err;
          // Wait 1s before retrying or switching model
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }
    throw lastError || new Error('All model attempts failed.');
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

      const response = await generateContentWithRetry({
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
      const isHighDemand = error?.message?.includes('503') || error?.message?.includes('high demand') || error?.status === 503;
      const userMessage = isHighDemand
        ? 'The AI Scanner service is currently experiencing high demand. Please try again in a moment.'
        : (error.message || 'Failed to process the URL.');
      res.status(500).json({ error: userMessage });
    }
  });

  // Mock or structural Notification Trigger Endpoint
  // This demonstrates the priority payload configuration required by the prompt
  app.post('/api/notifications/send', async (req, res) => {
    try {
      const { userId, type, title, body, url } = req.body;
      
      // Determine priority based on type
      const isHighPriority = type === 'order' || type === 'message' || type === 'purchase';
      
      const payload = {
        token: 'USER_DEVICE_TOKEN_PLACEHOLDER', // In a real app, fetch from DB
        notification: {
          title,
          body,
        },
        data: {
          url: url || '/',
          type: type || 'general',
          priority: isHighPriority ? 'high' : 'normal'
        },
        android: {
          priority: isHighPriority ? 'high' : 'normal',
          notification: {
            channelId: isHighPriority ? 'high_priority_alerts' : 'default_alerts',
            defaultSound: true,
            defaultVibrateTimings: true,
          }
        },
        apns: {
          headers: {
            'apns-priority': isHighPriority ? '10' : '5',
          },
          payload: {
            aps: {
              sound: isHighPriority ? 'default' : undefined,
              badge: 1
            }
          }
        },
        webpush: {
          headers: {
            Urgency: isHighPriority ? 'high' : 'normal'
          }
        }
      };

      console.log(`[Notification Engine] Dispatched ${isHighPriority ? 'HIGH' : 'NORMAL'} priority push to user ${userId}`);
      
      // In production: await admin.messaging().send(payload);
      res.json({ success: true, priority: isHighPriority ? 'high' : 'normal', payload });
    } catch (error: any) {
      console.error('Push notification error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route for AI Legal & Document Translation (Shona, Ndebele, English)
  app.post('/api/translate', async (req, res) => {
    try {
      const { text, targetLanguage } = req.body;
      if (!text || !targetLanguage) {
        return res.status(400).json({ error: 'text and targetLanguage parameters are required' });
      }

      if (targetLanguage.toLowerCase() === 'english' || targetLanguage.toLowerCase() === 'en') {
        return res.json({ translatedText: text });
      }

      if (!ai) {
        return res.status(503).json({ 
          error: 'Gemini AI client is not initialized. Please ensure GEMINI_API_KEY is configured in server environment.' 
        });
      }

      console.log(`[AI Translation Engine] Translating document into ${targetLanguage}...`);

      const response = await generateContentWithRetry({
        contents: `You are an expert official translator specializing in Zimbabwean official languages (English, Shona/chiShona, Ndebele/isiNdebele). 
Translate the following legal text accurately into ${targetLanguage}. 
Maintain clear, natural, high-quality phrasing and keep any numbers, section headers, or list structures intact:

${text}`,
      });

      const translatedText = response.text || '';
      res.json({ translatedText });
    } catch (error: any) {
      console.error('Translation error:', error);
      res.status(500).json({ error: error.message || 'Translation failed' });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', api_configured: !!ai });
  });

  // API Endpoints for Custom Password Reset Flow
  app.post('/api/auth/request-password-reset', async (req, res) => {
    try {
      const { email } = req.body;
      const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
      const host = req.get('host') || 'localhost:3000';

      const { handleRequestPasswordReset } = await import('./functions/src/handlers/requestPasswordReset');
      const { getAdminServices } = await import('./functions/src/lib/admin');
      const { db } = getAdminServices();

      const result = await handleRequestPasswordReset(db, {
        email,
        ipAddress: String(clientIp),
        appDomain: host,
      });

      res.json(result);
    } catch (err: any) {
      console.error('API /api/auth/request-password-reset error:', err);
      res.json({
        success: true,
        message: "If that email/phone number is registered, we've sent you a reset link/code.",
      });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, uid, newPassword } = req.body;
      const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

      const { handleResetPassword } = await import('./functions/src/handlers/resetPassword');
      const { getAdminServices } = await import('./functions/src/lib/admin');
      const { db } = getAdminServices();

      const result = await handleResetPassword(db, {
        token,
        uid,
        newPassword,
        ipAddress: String(clientIp),
      });

      res.json(result);
    } catch (err: any) {
      console.error('API /api/auth/reset-password error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
  });

  app.post('/api/auth/request-password-reset-phone', async (req, res) => {
    try {
      const { phone } = req.body;
      const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

      const { handleRequestPasswordResetPhone } = await import('./functions/src/handlers/requestPasswordResetPhone');
      const { getAdminServices } = await import('./functions/src/lib/admin');
      const { db } = getAdminServices();

      const result = await handleRequestPasswordResetPhone(db, {
        phone,
        ipAddress: String(clientIp),
      });

      res.json(result);
    } catch (err: any) {
      console.error('API /api/auth/request-password-reset-phone error:', err);
      res.json({
        success: true,
        message: "If that email/phone number is registered, we've sent you a reset link/code.",
      });
    }
  });

  app.post('/api/auth/reset-password-phone', async (req, res) => {
    try {
      const { idToken, newPassword } = req.body;
      const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

      const { handleResetPasswordAfterPhoneVerification } = await import('./functions/src/handlers/resetPasswordAfterPhoneVerification');
      const { getAdminServices } = await import('./functions/src/lib/admin');
      const { db } = getAdminServices();

      const result = await handleResetPasswordAfterPhoneVerification(db, {
        idToken,
        newPassword,
        ipAddress: String(clientIp),
      });

      res.json(result);
    } catch (err: any) {
      console.error('API /api/auth/reset-password-phone error:', err);
      res.status(500).json({ success: false, message: err?.message || 'Server error' });
    }
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
          desc = `Establish direct comms and mutual supply lines. Account ID: ${profileData.uid?.slice(0, 8)}. Powered by Comfort Business Hub.`;
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

  // Vite middleware for development vs Production static serving
  if (process.env.NODE_ENV !== 'production') {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Long-term caching for immutable hashed assets
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
      etag: true,
    }));
    // Standard caching for other public assets
    app.use(express.static(distPath, {
      maxAge: '1h',
      etag: true,
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Production Cluster] Server instance running on http://localhost:${PORT}`);
  });

  // Graceful shutdown handling for horizontal load balancing and container auto-scaling
  const handleGracefulShutdown = (signal: string) => {
    console.log(`[Load Balancer] ${signal} signal received: closing HTTP server smoothly...`);
    server.close(() => {
      console.log('[Load Balancer] HTTP server closed cleanly. Process exiting.');
      process.exit(0);
    });

    // Force exit after 10s timeout if connections hang
    setTimeout(() => {
      console.error('[Load Balancer] Forced shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
