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
  const url      = new URL(req.url, 'http://localhost');
  const segments = url.pathname.replace(/^\/api\/socialblade\/?/, '');

  const clientId = process.env.SOCIALBLADE_CLIENT_ID || process.env.VITE_SB_CLIENT_ID || '';
  const token    = process.env.SOCIALBLADE_TOKEN     || process.env.VITE_SB_TOKEN     || '';

  // Append credentials to query string (SB API accepts them as query params or headers)
  const params = new URLSearchParams(url.search);
  if (clientId) params.set('clientid', clientId);
  if (token)    params.set('token',    token);

  const targetUrl = `https://matrix.sbapis.com/b/${segments}?${params.toString()}`;

  const headers = { 'Accept': 'application/json' };
  if (clientId) headers['CLIENTID'] = clientId;
  if (token)    headers['token']    = token;

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
