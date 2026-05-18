import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
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
