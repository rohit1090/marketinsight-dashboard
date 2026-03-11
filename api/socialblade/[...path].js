// Vercel serverless function — proxies /api/socialblade/* → https://matrix.sbapis.com/b/*

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ status: { success: false, error: 'Method not allowed' } });
  }

  // Build target URL: strip /api/socialblade prefix, keep path + querystring
  const url       = new URL(req.url, 'http://localhost');
  const segments  = url.pathname.replace(/^\/api\/socialblade\/?/, '');
  const targetUrl = `https://matrix.sbapis.com/b/${segments}${url.search}`;

  const headers = { 'Accept': 'application/json' };
  if (process.env.SOCIALBLADE_CLIENT_ID) headers['CLIENTID'] = process.env.SOCIALBLADE_CLIENT_ID;
  if (process.env.SOCIALBLADE_TOKEN)     headers['token']    = process.env.SOCIALBLADE_TOKEN;

  try {
    const upstream = await fetch(targetUrl, { method: 'GET', headers });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    const body = await upstream.text();

    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    res.end(body);
  } catch (err) {
    res.status(500).json({ status: { success: false, error: String(err) } });
  }
}
