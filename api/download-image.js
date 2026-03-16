export default async function handler(req, res) {
  const { url } = req.query

  if (!url) {
    return res.status(400).json({ error: 'No URL' })
  }

  try {
    const decodedUrl = decodeURIComponent(url)

    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.freepik.com/',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'cross-site',
      }
    })

    if (!response.ok) {
      console.error('Fetch failed:', response.status, response.statusText)
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', 'attachment; filename="blog-image.jpg"')
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'no-cache')

    return res.status(200).send(buffer)

  } catch (err) {
    console.error('Download proxy error:', err.message)
    return res.status(500).json({
      error: err.message,
      hint: 'Image URL may have expired. Regenerate the image.'
    })
  }
}
