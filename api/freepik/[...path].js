export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { path } = req.query
  const pathStr = Array.isArray(path) ? path.join('/') : path
  const targetUrl = `https://api.freepik.com/${pathStr}`

  const queryString = new URLSearchParams(req.query)
  queryString.delete('path')
  const fullUrl = queryString.toString()
    ? `${targetUrl}?${queryString}`
    : targetUrl

  try {
    const response = await fetch(fullUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-freepik-api-key':
          process.env.FREEPIK_API_KEY ||
          process.env.VITE_FREEPIK_API_KEY ||
          'FPSX7fa9b8de502bc5b65c3b9d6cd585c7a5',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    })

    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
