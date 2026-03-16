import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { service } = req.query

  try {
    switch (service) {

      case 'groq': {
        const response = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify(req.body),
          }
        )
        const data = await response.json()
        if (!response.ok) {
          const retryAfter = response.headers.get('retry-after') || response.headers.get('x-ratelimit-reset-requests')
          if (retryAfter) data._retryAfter = retryAfter
        }
        return res.status(response.status).json(data)
      }

      case 'gemini': {
        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' })
        const { model, contents, config } = req.body
        if (!model || contents == null) return res.status(400).json({ error: '"model" and "contents" are required' })
        const ai = new GoogleGenAI({ apiKey })
        const response = await ai.models.generateContent({ model, contents, config })
        if (response.status === 429 || (response.error && String(response.error).includes('quota'))) {
          return res.status(429).json({ error: response.error || 'Quota exceeded' })
        }
        return res.status(200).json({
          text: response.text ?? '',
          candidates: response.candidates ?? [],
        })
      }

      case 'freepik': {
        const { path, ...body } = req.body
        const response = await fetch(
          `https://api.freepik.com${path}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-freepik-api-key': process.env.FREEPIK_API_KEY,
            },
            body: JSON.stringify(body),
          }
        )
        const data = await response.json()
        return res.status(response.status).json(data)
      }

      case 'freepik-get': {
        const { path } = req.query
        const response = await fetch(
          `https://api.freepik.com${path}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-freepik-api-key': process.env.FREEPIK_API_KEY,
            },
          }
        )
        const data = await response.json()
        return res.status(response.status).json(data)
      }

      case 'serpapi': {
        const params = new URLSearchParams({ ...req.query, api_key: process.env.SERPAPI_KEY })
        params.delete('service')
        const response = await fetch(`https://serpapi.com/search?${params}`)
        const data = await response.json()
        return res.status(response.status).json(data)
      }

      case 'socialblade': {
        const { sbpath, service: _s, ...rest } = req.query
        const params = new URLSearchParams(rest)
        const response = await fetch(
          `https://matrix.sbapis.com/b${sbpath}?${params}`,
          {
            headers: {
              'CLIENTID': process.env.VITE_SB_CLIENT_ID || '',
              'token': process.env.VITE_SB_TOKEN || '',
            },
          }
        )
        const data = await response.json()
        return res.status(response.status).json(data)
      }

      case 'upload-image': {
        const { imageUrl } = req.body
        if (!imageUrl) return res.status(400).json({ error: 'No imageUrl provided' })
        const imgResponse = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.freepik.com/',
            'sec-fetch-dest': 'image',
            'sec-fetch-mode': 'no-cors',
            'sec-fetch-site': 'cross-site',
          },
        })
        if (!imgResponse.ok) throw new Error(`Failed to fetch image: ${imgResponse.status}`)
        const buffer = Buffer.from(await imgResponse.arrayBuffer())
        const contentType = imgResponse.headers.get('content-type') || 'image/jpeg'
        res.setHeader('Content-Type', contentType)
        res.setHeader('Content-Disposition', 'attachment; filename="blog-image.jpg"')
        res.setHeader('Content-Length', buffer.length)
        res.setHeader('Cache-Control', 'no-cache')
        return res.status(200).send(buffer)
      }

      default:
        return res.status(400).json({ error: `Unknown service: ${service}` })
    }
  } catch (err) {
    console.error(`[proxy:${service}] Error:`, err.message)
    return res.status(500).json({ error: err.message })
  }
}
