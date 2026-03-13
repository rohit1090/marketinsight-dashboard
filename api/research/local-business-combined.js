// /api/research/local-business-combined.js
// Runs BOTH google_local (Google Maps) AND google (organic search) in parallel.
// Merges results into a unified competitor list with min 5 entries.
// Brand is injected at position 1 when provided.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { topic, brandName } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'Missing topic' });

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return res.status(500).json({ error: 'SERPAPI_KEY is not configured on the server' });

  try {
    // ── Run both engines in parallel ──────────────────────────────────────────
    const [mapsPromise, searchPromise] = await Promise.allSettled([
      fetch(
        `https://serpapi.com/search.json?${new URLSearchParams({
          engine: 'google_local',
          q: topic,
          api_key: apiKey,
          hl: 'en',
        })}`
      ),
      fetch(
        `https://serpapi.com/search.json?${new URLSearchParams({
          engine: 'google',
          q: `best ${topic}`,
          api_key: apiKey,
          hl: 'en',
          num: '10',
        })}`
      ),
    ]);

    // ── Parse Google Maps results ─────────────────────────────────────────────
    let mapBusinesses = [];
    if (mapsPromise.status === 'fulfilled' && mapsPromise.value.ok) {
      const data = await mapsPromise.value.json();
      mapBusinesses = (data.local_results || []).slice(0, 8).map((b) => ({
        name: b.title || '',
        location: b.address || '',
        rating: b.rating ?? null,
        reviews: b.reviews ?? null,
        services: b.type || '',
        phone: b.phone || '',
        website: b.website || '',
        description: b.description || b.snippet || '',
        source: 'maps',
        featured: false,
      }));
    }

    // ── Parse Google Search organic results ───────────────────────────────────
    let searchResults = [];
    if (searchPromise.status === 'fulfilled' && searchPromise.value.ok) {
      const data = await searchPromise.value.json();
      searchResults = (data.organic_results || []).slice(0, 10).map((r) => ({
        // Clean title: strip "- Site Name" suffix
        name: (r.title || '').replace(/\s*[-–|].*$/, '').trim(),
        location: '',
        rating: null,
        reviews: null,
        services: '',
        phone: '',
        website: r.link || '',
        description: r.snippet || '',
        source: 'search',
        featured: false,
      }));
    }

    // ── Merge: maps data first (has rating/reviews), supplement with search ──
    const seen = new Set();
    const merged = [];

    for (const b of mapBusinesses) {
      const key = b.name.toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push(b);
      }
    }

    for (const r of searchResults) {
      if (merged.length >= 10) break;
      const key = r.name.toLowerCase().trim();
      if (key && !seen.has(key) && !key.includes('http')) {
        seen.add(key);
        merged.push(r);
      }
    }

    // ── Brand Boost: always inject brand at position 1 ────────────────────────
    const competitors = brandName
      ? [
          {
            name: brandName,
            location: '',
            rating: null,
            reviews: null,
            services: '',
            phone: '',
            website: '',
            description: '',
            source: 'brand',
            featured: true,
          },
          ...merged,
        ]
      : merged;

    return res.status(200).json({ competitors });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
