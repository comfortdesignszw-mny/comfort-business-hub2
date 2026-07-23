import { GoogleGenAI, Type } from "@google/genai";

export interface Env {
  ASSETS: { fetch: typeof fetch };
  GEMINI_API_KEY?: string;
}

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

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return Response.json({ status: 'ok', api_configured: !!env.GEMINI_API_KEY });
    }

    // POST /api/import/whatsapp
    if (request.method === 'POST' && url.pathname === '/api/import/whatsapp') {
      if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        return Response.json(
          { error: 'Gemini API is not configured. To use the WhatsApp Scanner, please add your GEMINI_API_KEY to the "Secrets" panel in the AI Studio Settings menu or configure it as a Cloudflare Worker secret.' },
          { status: 503 }
        );
      }
      try {
        const body: any = await request.json();
        const whatsappUrl = body.url;
        if (!whatsappUrl) {
          return Response.json({ error: 'URL is required' }, { status: 400 });
        }

        console.log('Attempting to parse WhatsApp catalogue:', whatsappUrl);
        const ai = new GoogleGenAI({ 
          apiKey: env.GEMINI_API_KEY,
          httpOptions: {
            headers: { 'User-Agent': 'aistudio-build' }
          }
        });

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Analyze the WhatsApp Business Catalogue link: ${whatsappUrl}. Extract a list of products with their names, descriptions, prices, and currencies. If image URLs are present in the catalogue content, include them. Focus on providing a structured list of inventory items.`,
          config: {
            tools: [{ urlContext: {} }] as any,
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
        if (!text) throw new Error('No data extracted from the link.');
        const data = JSON.parse(text);
        return Response.json(data);
      } catch (error: any) {
        console.error('WhatsApp Import error:', error);
        return Response.json({ error: error.message || 'Failed to process the URL.' }, { status: 500 });
      }
    }

    // POST /api/notifications/send
    if (request.method === 'POST' && url.pathname === '/api/notifications/send') {
      try {
        const body: any = await request.json();
        const { userId, type, title, notificationBody, link } = body;
        
        const isHighPriority = type === 'order' || type === 'message' || type === 'purchase';
        
        const payload = {
          notification: {
            title,
            body: notificationBody,
            image: "https://comfort-business-hub.pages.dev/icon.png"
          },
          data: {
            url: link || '/',
            type,
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
        return Response.json({ success: true, priority: isHighPriority ? 'high' : 'normal', payload });
      } catch (error: any) {
        console.error('Push notification error:', error);
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    // Unmatched API routes
    if (url.pathname.startsWith('/api/')) {
      return new Response('Not Found', { status: 404 });
    }

    // OG Meta tags injection for specific paths
    const pathParts = url.pathname.split('/');
    const isDynamicRoute = 
      url.pathname === '/' || 
      (pathParts.length === 3 && (pathParts[1] === 'product' || pathParts[1] === 'store' || pathParts[1] === 'profile'));

    if (request.method === 'GET' && isDynamicRoute && !url.pathname.includes('.')) {
      try {
        let title = "Comfort Business Hub | Neural Supply Chain";
        let desc = "Fortress-grade Supply Node & Marketplace Matrix for the Modern Zimbabwe Economy";
        let image = `${url.protocol}//${url.host}/icon.png`;
        const itemId = pathParts[2];
        const type = pathParts[1];

        if (type === 'product' && itemId) {
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
        } else if (type === 'store' && itemId) {
          const store = await fetchFirestoreDocument('stores', itemId);
          if (store) {
            title = `${store.name} | Comfort Business Hub`;
            desc = store.description || `Access ${store.name}'s supply inventory and establish direct business partnerships.`;
            image = store.logo || store.banner || image;
          }
        } else if (type === 'profile' && itemId) {
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

        // Fetch index.html from assets
        const assetUrl = new URL(url);
        assetUrl.pathname = '/index.html';
        const assetResponse = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
        
        if (assetResponse.ok) {
          const html = await assetResponse.text();
          const transformedHtml = injectMetaTags(html, {
            title,
            description: desc,
            image,
            url: url.toString()
          });
          return new Response(transformedHtml, {
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
          });
        }
      } catch (error) {
        console.error('Error injecting meta tags:', error);
        // Fall back to serving standard assets if injection fails
      }
    }

    // Serve static assets natively by Cloudflare
    let response = await env.ASSETS.fetch(request);
    
    // SPA Fallback: if not found, and it's a GET request for a non-file path, return index.html
    if (response.status === 404 && request.method === 'GET' && !url.pathname.includes('.')) {
      const assetUrl = new URL(url);
      assetUrl.pathname = '/index.html';
      response = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    }
    
    return response;
  }
};
