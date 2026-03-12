// /api/research/informational.js
// Fetches informational search results from Google via SerpAPI.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topic } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'Missing topic' });

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return res.status(500).json({ error: 'SERPAPI_KEY is not configured on the server' });

  try {
    const params = new URLSearchParams({
      engine: 'google',
      q: topic,
      api_key: apiKey,
      num: '8',
      hl: 'en',
    });

    const response = await fetch(`https://serpapi.com/search.json?${params}`);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || 'SerpAPI error' });
    }

    const results = (data.organic_results || []).slice(0, 6).map((r) => ({
      title: r.title || '',
      snippet: r.snippet || '',
      link: r.link || '',
    }));

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
