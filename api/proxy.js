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
        const params = new URLSearchParams({ ...req.query, api_key: process.env.SERPAPI_KEY || process.env.VITE_SERPAPI_KEY })
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

      case 'dataforseo': {
        const { endpoint, payload } = req.body

        console.log('[DFS] Endpoint:', endpoint)
        console.log('[DFS] Login exists:', !!process.env.DATAFORSEO_LOGIN)
        console.log('[DFS] Password exists:', !!process.env.DATAFORSEO_PASSWORD)

        if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
          return res.status(500).json({
            error: 'DataForSEO credentials missing',
            hint: 'Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD to .env'
          })
        }
        if (!endpoint || !payload) {
          return res.status(400).json({ error: 'Missing endpoint or payload' })
        }

        const credentials = Buffer.from(
          `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
        ).toString('base64')

        const dfsUrl = `https://api.dataforseo.com${endpoint}`
        console.log('[DFS] Calling:', dfsUrl)

        const dfsRes = await fetch(dfsUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([payload]),
        })

        console.log('[DFS] Response status:', dfsRes.status)

        const text = await dfsRes.text()
        console.log('[DFS] Response preview:', text.slice(0, 300))

        let data
        try {
          data = JSON.parse(text)
        } catch {
          console.error('[DFS] JSON parse failed:', text.slice(0, 500))
          return res.status(500).json({
            error: 'DataForSEO returned invalid JSON',
            raw: text.slice(0, 200)
          })
        }

        if (data.status_code === 40101) {
          return res.status(401).json({ error: 'DataForSEO: Invalid credentials' })
        }
        if (data.status_code === 40001) {
          return res.status(402).json({ error: 'DataForSEO: Insufficient credits' })
        }
        if (data.status_code !== 20000) {
          return res.status(400).json({
            error: data.status_message || 'DataForSEO error',
            status_code: data.status_code
          })
        }

        return res.status(200).json(data.tasks || [])
      }

      case 'dataforseo-get': {
        const { endpoint } = req.body
        if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' })

        const credentials = Buffer.from(
          `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
        ).toString('base64')

        const dfsRes = await fetch(`https://api.dataforseo.com${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
        })

        const text = await dfsRes.text()
        let data
        try { data = JSON.parse(text) }
        catch { return res.status(500).json({ error: 'Invalid JSON', raw: text.slice(0, 200) }) }

        return res.status(200).json(data.tasks || [])
      }

      case 'dataforseo-locations': {
        const { country } = req.query
        if (!country) return res.status(400).json({ error: 'Missing country parameter' })

        const credentials = Buffer.from(
          `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
        ).toString('base64')

        const locRes = await fetch(`https://api.dataforseo.com/v3/serp/google/locations/${country}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
        })

        const text = await locRes.text()
        let data
        try { data = JSON.parse(text) }
        catch { return res.status(500).json({ error: 'Invalid JSON', raw: text.slice(0, 200) }) }

        return res.status(200).json(data.result || [])
      }

      case 'dataforseo-ranked-keywords': {
        const { endpoint, payload } = req.body
        if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
          return res.status(500).json({ error: 'DataForSEO credentials missing' })
        }
        const credentials = Buffer.from(
          `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
        ).toString('base64')
        const dfsRes = await fetch(`https://api.dataforseo.com${endpoint}`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([payload]),
        })
        const text = await dfsRes.text()
        let data
        try { data = JSON.parse(text) }
        catch { return res.status(500).json({ error: 'Invalid JSON', raw: text.slice(0, 200) }) }
        if (data.status_code === 40101) return res.status(401).json({ error: 'DataForSEO: Invalid credentials' })
        if (data.status_code !== 20000) return res.status(400).json({ error: data.status_message || 'DataForSEO error', status_code: data.status_code })
        return res.status(200).json(data.tasks || [])
      }

      case 'dataforseo-historical-rank': {
        const { payload } = req.body
        if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
          return res.status(500).json({ error: 'DataForSEO credentials missing' })
        }
        const credentials = Buffer.from(
          `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
        ).toString('base64')
        const dfsRes = await fetch(
          'https://api.dataforseo.com/v3/dataforseo_labs/google/historical_rank_overview/live',
          {
            method: 'POST',
            headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
            body: JSON.stringify([payload]),
          }
        )
        const text = await dfsRes.text()
        let data
        try { data = JSON.parse(text) }
        catch { return res.status(500).json({ error: 'Invalid JSON', raw: text.slice(0, 200) }) }
        if (data.status_code === 40101) return res.status(401).json({ error: 'DataForSEO: Invalid credentials' })
        if (data.status_code !== 20000) return res.status(400).json({ error: data.status_message || 'DataForSEO error', status_code: data.status_code })
        console.log('[historical-rank] result[0] preview:', JSON.stringify(data.tasks?.[0]?.result?.[0]).slice(0, 400))
        return res.status(200).json(data.tasks?.[0]?.result ?? [])
      }

      // ── DataForSEO SERP endpoints (organic / maps / shopping) ─────────────────
      case 'dataforseo-serp-organic':
      case 'dataforseo-serp-maps':
      case 'dataforseo-serp-shopping': {
        if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
          return res.status(500).json({ error: 'DataForSEO credentials missing' })
        }
        const serpEndpointMap = {
          'dataforseo-serp-organic':  '/v3/serp/google/organic/live/advanced',
          'dataforseo-serp-maps':     '/v3/serp/google/maps/live/advanced',
          'dataforseo-serp-shopping': '/v3/serp/google/shopping/live/advanced',
        }
        const serpDfsEndpoint = serpEndpointMap[service]
        const serpCredentials = Buffer.from(
          `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
        ).toString('base64')
        // Client sends payload array directly (already wrapped in [])
        const serpRes = await fetch(`https://api.dataforseo.com${serpDfsEndpoint}`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${serpCredentials}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body),
        })
        const serpText = await serpRes.text()
        let serpData
        try { serpData = JSON.parse(serpText) }
        catch { return res.status(500).json({ error: 'DFS SERP returned invalid JSON', raw: serpText.slice(0, 200) }) }
        if (serpData.status_code === 40101) return res.status(401).json({ error: 'DataForSEO: Invalid credentials' })
        if (serpData.status_code === 40001) return res.status(402).json({ error: 'DataForSEO: Insufficient credits' })
        if (serpData.status_code !== 20000) {
          return res.status(400).json({ error: serpData.status_message || 'DFS SERP error', status_code: serpData.status_code })
        }
        console.log(`[${service}] items:`, serpData.tasks?.[0]?.result?.[0]?.items?.length ?? 0)
        return res.status(200).json(serpData)
      }

      default:
        return res.status(400).json({ error: `Unknown service: ${service}` })
    }
  } catch (err) {
    console.error(`[proxy:${service}] Error:`, err.message)
    return res.status(500).json({ error: err.message })
  }
}
