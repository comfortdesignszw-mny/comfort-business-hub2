import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function ingestWhatsAppCatalog(text: string) {
  try {
    const prompt = `
      Extract product details from this WhatsApp Business catalog text.
      Return a JSON array of objects with: name, description, price, currency, category.
      Text: "${text}"
    `;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    
    const jsonStr = response.text.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to ingest catalog:', error);
    return [];
  }
}
