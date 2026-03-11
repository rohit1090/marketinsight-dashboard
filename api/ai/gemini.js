/**
 * /api/ai/gemini.js
 *
 * Secure serverless proxy for all Google Gemini API calls.
 * Uses the @google/genai SDK server-side so the GEMINI_API_KEY
 * is never bundled into or exposed by the frontend.
 *
 * Request body: { model, contents, config }
 * Response:     { text, candidates }
 *   - text       → extracted text from first candidate
 *   - candidates → full candidates array (includes groundingMetadata for grounded calls)
 */

import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
  }

  const { model, contents, config } = req.body;
  if (!model || contents == null) {
    return res.status(400).json({ error: '"model" and "contents" are required' });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({ model, contents, config });

    return res.status(200).json({
      text: response.text ?? '',
      candidates: response.candidates ?? [],
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[gemini proxy] error:', msg);

    // Pass through quota/rate-limit signals so the frontend
    // fallback logic in fetchLiveMarketIntel can detect them.
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      return res.status(429).json({ error: msg });
    }

    return res.status(500).json({ error: msg || 'Gemini request failed' });
  }
}
