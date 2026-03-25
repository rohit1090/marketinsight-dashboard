// Research service — fetches real Google data per category before AI generation.
// PRIMARY: DataForSEO SERP API (92% cheaper than SerpAPI)
// FALLBACK: SerpAPI via /api/research/* (if DataForSEO fails)

import {
  getCached, setCache, getOrganicItems, getMapsItems, getShoppingItems, DFS_DEFAULT_LOCATION,
} from './researchCache';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface LocalBusiness {
  name: string;
  address: string;
  rating: number | null;
  reviews: number | null;
  type: string;
  phone: string;
  website: string;
  featured: boolean;
}

export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

export interface LocalBusinessResearch {
  businesses: LocalBusiness[];
}

export interface SearchResearch {
  results: SearchResult[];
}

export interface CompetitorEntry {
  name: string;
  location: string;
  rating: number | null;
  reviews: number | null;
  services: string;
  phone: string;
  website: string;
  description: string;
  source: string;
  featured: boolean;
}

export interface CombinedLocalResearch {
  competitors: CompetitorEntry[];
}

// ─── (cache/helpers/dfsSerpCall/getOrganicItems imported from researchCache.ts) ─

// ─── Response mappers ─────────────────────────────────────────────────────────

function mapOrganicToSearchResearch(items: any[]): SearchResearch {
  const results = items
    .filter((item: any) => item.type === 'organic')
    .slice(0, 10)
    .map((item: any) => ({
      title:   item.title        ?? '',
      snippet: item.description  ?? '',
      link:    item.url          ?? '',
    }));
  return { results };
}

function mapMapsToLocalBusinessResearch(items: any[], brandName?: string): LocalBusinessResearch {
  const businesses: LocalBusiness[] = items
    .filter((item: any) => item.type === 'maps_search' || item.type === 'local_pack')
    .slice(0, 10)
    .map((item: any, i: number) => {
      const ratingVal = typeof item.rating === 'object' ? item.rating?.value : item.rating;
      const reviewVal = typeof item.rating === 'object' ? item.rating?.votes_count : item.rating_count;
      const isFeatured = brandName
        ? (item.title ?? '').toLowerCase().includes(brandName.toLowerCase())
        : i === 0;
      return {
        name:     item.title ?? item.value ?? '',
        address:  item.address ?? '',
        rating:   ratingVal ?? null,
        reviews:  reviewVal ?? null,
        type:     item.category ?? item.snippet ?? '',
        phone:    item.phone ?? '',
        website:  item.url ?? (item.domain ? `https://${item.domain}` : ''),
        featured: isFeatured,
      };
    });
  return { businesses };
}

function mapShoppingToSearchResearch(items: any[]): SearchResearch {
  const results = items
    .filter((item: any) => item.type === 'shopping' || item.type === 'paid')
    .slice(0, 10)
    .map((item: any) => ({
      title:   item.title ?? '',
      snippet: item.description ?? [item.price, item.currency].filter(Boolean).join(' '),
      link:    item.url ?? '',
    }));
  return { results };
}

function mapCombinedToLocalResearch(
  mapsItems: any[],
  organicItems: any[],
  brandName?: string,
): CombinedLocalResearch {
  const competitors: CompetitorEntry[] = [];

  // Maps results first (richer data)
  mapsItems
    .filter((item: any) => item.type === 'maps_search' || item.type === 'local_pack')
    .slice(0, 8)
    .forEach((item: any, i: number) => {
      const ratingVal = typeof item.rating === 'object' ? item.rating?.value : item.rating;
      const reviewVal = typeof item.rating === 'object' ? item.rating?.votes_count : item.rating_count;
      competitors.push({
        name:        item.title ?? item.value ?? '',
        location:    item.address ?? '',
        rating:      ratingVal ?? null,
        reviews:     reviewVal ?? null,
        services:    item.category ?? item.snippet ?? '',
        phone:       item.phone ?? '',
        website:     item.url ?? (item.domain ? `https://${item.domain}` : ''),
        description: item.snippet ?? '',
        source:      'Google Maps',
        featured: brandName
          ? (item.title ?? '').toLowerCase().includes(brandName.toLowerCase())
          : i === 0,
      });
    });

  // Fill remaining slots from organic results
  const needed = Math.max(0, 5 - competitors.length);
  organicItems
    .filter((item: any) => item.type === 'organic')
    .slice(0, needed)
    .forEach((item: any) => {
      const alreadyIn = competitors.some(
        c => c.website && item.url && c.website.includes(item.domain ?? '___'),
      );
      if (!alreadyIn) {
        competitors.push({
          name:        item.title ?? '',
          location:    '',
          rating:      null,
          reviews:     null,
          services:    '',
          phone:       '',
          website:     item.url ?? '',
          description: item.description ?? '',
          source:      'Google Search',
          featured:    false,
        });
      }
    });

  return { competitors };
}

// ─── SerpAPI fallback helpers (original /api/research/* routes) ───────────────

async function postResearch<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Research API error ${res.status}`);
  return data as T;
}

// ─── Exported fetch functions ──────────────────────────────────────────────────

export async function fetchLocalBusinesses(topic: string, brandName?: string): Promise<LocalBusinessResearch> {
  const normalized = topic.trim().toLowerCase();
  const cacheKey = `local_business_${normalized}_${(brandName ?? '').toLowerCase()}`;
  const cached = getCached<LocalBusinessResearch>(cacheKey);
  if (cached) { console.log('[Research] Cache hit for:', topic); return cached; }

  try {
    console.log('[Research] Using DataForSEO (maps) for:', topic);
    const items = await getMapsItems(topic, DFS_DEFAULT_LOCATION, 10, 'fetchLocalBusinesses');
    const data = mapMapsToLocalBusinessResearch(items, brandName);
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.warn('[Research] DataForSEO failed, falling back to SerpAPI:', err);
    return postResearch<LocalBusinessResearch>('/api/research/local-business', { topic, brandName });
  }
}

export async function fetchLocalBusinessesCombined(topic: string, brandName?: string): Promise<CombinedLocalResearch> {
  const normalized = topic.trim().toLowerCase();
  const cacheKey = `local_combined_${normalized}_${(brandName ?? '').toLowerCase()}`;
  const cached = getCached<CombinedLocalResearch>(cacheKey);
  if (cached) { console.log('[Research] Cache hit for:', topic); return cached; }

  try {
    console.log('[Research] Using DataForSEO (maps + organic) for:', topic);
    const [mapsItems, organicItems] = await Promise.all([
      getMapsItems(topic, DFS_DEFAULT_LOCATION, 10, 'fetchLocalBusinessesCombined'),
      getOrganicItems(topic, DFS_DEFAULT_LOCATION, 10, 'fetchLocalBusinessesCombined'),
    ]);
    const data = mapCombinedToLocalResearch(mapsItems, organicItems, brandName);
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.warn('[Research] DataForSEO failed, falling back to SerpAPI:', err);
    return postResearch<CombinedLocalResearch>('/api/research/local-business-combined', { topic, brandName });
  }
}

export async function fetchProductResults(topic: string): Promise<SearchResearch> {
  const normalized = topic.trim().toLowerCase();
  const cacheKey = `products_${normalized}`;
  const cached = getCached<SearchResearch>(cacheKey);
  if (cached) { console.log('[Research] Cache hit for:', topic); return cached; }

  try {
    console.log('[Research] Using DataForSEO (shopping) for:', topic);
    const items = await getShoppingItems(topic, DFS_DEFAULT_LOCATION, 10, 'fetchProductResults');
    // Shopping may return 0 items for some queries — fall back to organic (cached)
    const data = items.length > 0
      ? mapShoppingToSearchResearch(items)
      : mapOrganicToSearchResearch(await getOrganicItems(topic, DFS_DEFAULT_LOCATION, 10, 'fetchProductResults'));
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.warn('[Research] DataForSEO failed, falling back to SerpAPI:', err);
    return postResearch<SearchResearch>('/api/research/products', { topic });
  }
}

export async function fetchEducationResults(topic: string): Promise<SearchResearch> {
  const normalized = topic.trim().toLowerCase();
  const cacheKey = `education_${normalized}`;
  const cached = getCached<SearchResearch>(cacheKey);
  if (cached) { console.log('[Research] Cache hit for:', topic); return cached; }

  try {
    console.log('[Research] Using DataForSEO (organic) for:', topic);
    const items = await getOrganicItems(topic, DFS_DEFAULT_LOCATION, 10, 'fetchEducationResults');
    const data = mapOrganicToSearchResearch(items);
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.warn('[Research] DataForSEO failed, falling back to SerpAPI:', err);
    return postResearch<SearchResearch>('/api/research/education', { topic });
  }
}

export async function fetchInformationalResults(topic: string): Promise<SearchResearch> {
  const normalized = topic.trim().toLowerCase();
  const cacheKey = `informational_${normalized}`;
  const cached = getCached<SearchResearch>(cacheKey);
  if (cached) { console.log('[Research] Cache hit for:', topic); return cached; }

  try {
    console.log('[Research] Using DataForSEO (organic) for:', topic);
    const items = await getOrganicItems(topic, DFS_DEFAULT_LOCATION, 10, 'fetchInformationalResults');
    const data = mapOrganicToSearchResearch(items);
    setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.warn('[Research] DataForSEO failed, falling back to SerpAPI:', err);
    return postResearch<SearchResearch>('/api/research/informational', { topic });
  }
}

// ─── Prompt formatters (UNCHANGED — prompt builders depend on these shapes) ───

export function formatLocalBusinessResearch(data: LocalBusinessResearch): string {
  if (!data.businesses?.length) return '';
  const lines = data.businesses.map((b, i) => {
    const tag     = b.featured ? ' ⭐ [FEATURED — list this business FIRST]' : '';
    const rating  = b.rating  != null ? ` | Rating: ${b.rating}` : '';
    const reviews = b.reviews != null ? ` (${b.reviews} reviews)` : '';
    const type    = b.type    ? `\n   Type: ${b.type}` : '';
    const phone   = b.phone   ? `\n   Phone: ${b.phone}` : '';
    const website = b.website ? `\n   Website: ${b.website}` : '';
    return `${i + 1}. ${b.name}${tag}\n   Address: ${b.address || 'N/A'}${rating}${reviews}${type}${phone}${website}`;
  });
  return `━━━ GOOGLE LOCAL RESEARCH (google_local engine) — Real businesses found ━━━\n${lines.join('\n\n')}`;
}

export function formatSearchResearch(data: SearchResearch, label: string): string {
  if (!data.results?.length) return '';
  const lines = data.results.map((r, i) =>
    `${i + 1}. ${r.title}\n   ${r.snippet}${r.link ? `\n   Source: ${r.link}` : ''}`
  );
  return `━━━ GOOGLE SEARCH RESEARCH — ${label} ━━━\n${lines.join('\n\n')}`;
}

export function formatCombinedLocalResearch(data: CombinedLocalResearch): string {
  if (!data.competitors?.length) return '';

  const lines = data.competitors.map((c, i) => {
    const tag     = c.featured ? ' ⭐ [YOUR BRAND — ALWAYS LIST FIRST]' : '';
    const rating  = c.rating  != null ? `${c.rating} ⭐` : 'N/A';
    const reviews = c.reviews != null ? ` (${c.reviews} reviews)` : '';
    return [
      `${i + 1}. ${c.name}${tag}`,
      `   📍 Location: ${c.location || 'N/A'}`,
      `   ⭐ Rating: ${rating}${reviews}`,
      `   🛠️ Services/Type: ${c.services || 'N/A'}`,
      `   📞 Phone: ${c.phone || 'N/A'}`,
      `   🌐 Website: ${c.website || 'N/A'}`,
      `   📝 Description: ${c.description || 'N/A'}`,
    ].join('\n');
  });

  return `━━━ COMPETITOR RESEARCH DATA (Google Maps + Google Search combined) ━━━
Total competitors found: ${data.competitors.length}

${lines.join('\n\n')}

━━━ ARTICLE GENERATION RULES FOR THIS DATA ━━━
• The ⭐ [YOUR BRAND] entry MUST appear first in ALL lists, tables, and sections.
• Generate one <h3> block per competitor — use the actual name from the data above.
• Build a valid HTML comparison <table> containing ALL ${data.competitors.length} competitors (minimum 5 rows).
• Use real ratings, locations, and descriptions from the data above.
• Do NOT invent competitor names or fabricate data not listed here.
• If description is N/A, use your knowledge of that type of business to fill in services.`;
}
