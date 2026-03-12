// /api/research/local-business.js
// Fetches real local businesses via SerpAPI google_local engine (Google Places).
// ONLY used for "Local Business / City" category — never for products/educational/informational.
// Returns top 8 results, with optional brandName injected first.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topic, brandName } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'Missing topic' });

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return res.status(500).json({ error: 'SERPAPI_KEY is not configured on the server' });

  try {
    const params = new URLSearchParams({
      engine: 'google_local',
      q: topic,
      api_key: apiKey,
      hl: 'en',
    });

    const response = await fetch(`https://serpapi.com/search.json?${params}`);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || 'SerpAPI error' });
    }

    const raw = (data.local_results || []).slice(0, 8).map((b) => ({
      name: b.title || '',
      address: b.address || '',
      rating: b.rating ?? null,
      reviews: b.reviews ?? null,
      type: b.type || '',
      phone: b.phone || '',
      website: b.website || '',
      featured: false,
    }));

    // Brand Boost: inject brand as first entry
    const businesses = brandName
      ? [{ name: brandName, address: '', rating: null, reviews: null, website: '', featured: true }, ...raw]
      : raw;

    return res.status(200).json({ businesses });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
