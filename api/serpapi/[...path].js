// Vercel serverless function — proxies /api/serpapi/* → https://serpapi.com/*
// This replaces the Vite dev-server proxy (which only works locally).

export default async function handler(req, res) {
  // Build the target URL: strip /api/serpapi prefix, keep the rest + querystring
  const url = new URL(req.url, 'http://localhost');
  // path segments after /api/serpapi/
  const segments = url.pathname.replace(/^\/api\/serpapi\/?/, '');
  const targetUrl = `https://serpapi.com/${segments}${url.search}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    const body = await upstream.text();

    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(body);
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', detail: String(err) });
  }
}