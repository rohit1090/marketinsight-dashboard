/**
 * /api/freepik/[...path].js
 *
 * Secure serverless proxy for Freepik AI API calls.
 * Injects the server-side API key so it's never exposed to the browser.
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const apiKey = process.env.FREEPIK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'FREEPIK_API_KEY is not configured on the server' });
  }

  // req.query.path is the catch-all segments array, e.g. ['v1', 'ai', 'mystic', 'taskId']
  const { path } = req.query;
  const freepikPath = Array.isArray(path) ? path.join('/') : (path || '');
  const url = `https://api.freepik.com/${freepikPath}`;

  const fetchOptions = {
    method: req.method,
    headers: {
      'x-freepik-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  };

  if (req.method === 'POST' && req.body) {
    fetchOptions.body = JSON.stringify(req.body);
  }

  try {
    const response = await fetch(url, fetchOptions);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[freepik proxy] error:', error);
    return res.status(500).json({ error: 'Freepik request failed' });
  }
}
