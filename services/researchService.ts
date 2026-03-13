// Research service — fetches real Google data per category before AI generation.
// All API keys stay server-side; this file only calls /api/research/* proxies.

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

// ── Combined local business competitor data (Google Maps + Google Search) ──────

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

/** Runs BOTH google_local (Maps) + google (Search) — used for Local Business / City category */
export async function fetchLocalBusinessesCombined(topic: string, brandName?: string): Promise<CombinedLocalResearch> {
  return postResearch<CombinedLocalResearch>('/api/research/local-business-combined', { topic, brandName });
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
    const type = b.type ? `\n   Type: ${b.type}` : '';
    const phone = b.phone ? `\n   Phone: ${b.phone}` : '';
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

/**
 * Formats combined Google Maps + Google Search competitor data into a
 * structured block for Groq prompt injection.
 * Brand is always at position 1 (injected by the API).
 */
export function formatCombinedLocalResearch(data: CombinedLocalResearch): string {
  if (!data.competitors?.length) return '';

  const lines = data.competitors.map((c, i) => {
    const tag = c.featured ? ' ⭐ [YOUR BRAND — ALWAYS LIST FIRST]' : '';
    const rating = c.rating != null ? `${c.rating} ⭐` : 'N/A';
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
