// Research service — fetches real Google data per category before AI generation.
// All API keys stay server-side; this file only calls /api/research/* proxies.

export interface LocalBusiness {
  name: string;
  address: string;
  rating: number | null;
  reviews: number | null;
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

export async function fetchLocalBusinesses(topic: string, brandName?: string): Promise<LocalBusinessResearch> {
  return postResearch<LocalBusinessResearch>('/api/research/local-business', { topic, brandName });
}

export async function fetchProductResults(topic: string): Promise<SearchResearch> {
  return postResearch<SearchResearch>('/api/research/products', { topic });
}

export async function fetchEducationResults(topic: string): Promise<SearchResearch> {
  return postResearch<SearchResearch>('/api/research/education', { topic });
}

export async function fetchInformationalResults(topic: string): Promise<SearchResearch> {
  return postResearch<SearchResearch>('/api/research/informational', { topic });
}

// ── Prompt formatters ──────────────────────────────────────────────────────────
// Convert raw research data into a clean text block for prompt injection.

export function formatLocalBusinessResearch(data: LocalBusinessResearch): string {
  if (!data.businesses?.length) return '';
  const lines = data.businesses.map((b, i) => {
    const tag = b.featured ? ' ⭐ [FEATURED — list this business FIRST]' : '';
    const rating = b.rating != null ? ` | Rating: ${b.rating}` : '';
    const reviews = b.reviews != null ? ` (${b.reviews} reviews)` : '';
    return `${i + 1}. ${b.name}${tag}\n   Address: ${b.address || 'N/A'}${rating}${reviews}${b.website ? `\n   Website: ${b.website}` : ''}`;
  });
  return `━━━ GOOGLE MAPS RESEARCH — Real businesses found for this topic ━━━\n${lines.join('\n\n')}`;
}

export function formatSearchResearch(data: SearchResearch, label: string): string {
  if (!data.results?.length) return '';
  const lines = data.results.map((r, i) =>
    `${i + 1}. ${r.title}\n   ${r.snippet}${r.link ? `\n   Source: ${r.link}` : ''}`
  );
  return `━━━ GOOGLE SEARCH RESEARCH — ${label} ━━━\n${lines.join('\n\n')}`;
}
