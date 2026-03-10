/**
 * seoRankingService.ts
 *
 * Fetches real Google SERP data for a keyword+location via SerpAPI and maps
 * it to the KeywordData shape used by SeoSuitePanel's Rankings table.
 *
 * Architecture — scalable services alongside this file:
 *   services/seoRankingService.ts    ← this file (Google rank positions)
 *   services/seoKeywordService.ts    ← keyword research / volume / CPC data
 *   services/seoCompetitorService.ts ← competitor gap analysis
 *   services/seoAuditService.ts      ← technical SEO audits
 *
 * All services call the same /api/serpapi proxy (defined in vite.config.ts)
 * which forwards requests to https://serpapi.com server-side to avoid CORS.
 *
 * To swap data sources later:
 *   - Google Search Console API → replace serpSearch() with GSC rows[]
 *   - DataForSEO               → replace with tasks/get endpoint
 *   - Ahrefs / Semrush API     → replace volume/difficulty helpers
 */

const SERPAPI_BASE = '/api/serpapi/search.json';

// Maps LOCATIONS dropdown values → SerpAPI `gl` country codes
const LOCATION_TO_GL: Record<string, string> = {
  'Global':  '',
  'US':      'us',
  'UK':      'gb',
  'CA':      'ca',
  'AU':      'au',
  'DE':      'de',
  'FR':      'fr',
};

/**
 * Converts a location string to a SerpAPI `gl` code.
 * All "India - *" variants map to "in".
 * Unknown values fall back to "us".
 */
function toGl(location: string): string {
  if (location.startsWith('India')) return 'in';
  return LOCATION_TO_GL[location] ?? 'us';
}

// --- Types ---

export interface RankingResult {
  keyword:     string;
  location:    string;
  /** Tracked domain's Google rank (1–10). 0 = domain not found in top 10. */
  rank:        number;
  /** URL of the tracked domain's ranking page (falls back to #1 result when untracked). */
  url:         string;
  title:       string;
  change:      number;        // 0 on first fetch; positive = moved up, negative = dropped
  volume:      number;        // placeholder — replace with DataForSEO / Ahrefs later
  difficulty:  number;        // placeholder — replace with Semrush / Ahrefs later
  serpResults: SerpItem[];    // top 5 real competitor URLs from Google
  /** true when trackedDomain was found in the results */
  inTopTen:    boolean;
  fetchedAt:   string;
}

export interface SerpItem {
  rank:   number;
  title:  string;
  url:    string;
  domain: string;
}

interface SerpOrganic {
  position: number;
  title:    string;
  link:     string;
  snippet?: string;
  displayed_link?: string;
}

interface SerpResponse {
  organic_results?: SerpOrganic[];
  error?: string;
}

// --- Internal helpers ---

/** Extracts the root domain from a URL (strips www.) */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Finds the rank of a tracked domain within organic results.
 *
 * Matching is intentionally loose (includes) so both:
 *   - "mybrand.com" matches "https://mybrand.com/blog/seo"
 *   - "app.mybrand.com" also matches
 *
 * Returns the matching result or null when the domain is not in top 10.
 * To support Google Search Console data later, replace this function with
 * a GSC rows[].keys lookup where keys[0] = page URL.
 */
function findDomainRank(
  results: SerpOrganic[],
  trackedDomain: string,
): SerpOrganic | null {
  if (!trackedDomain.trim()) return null;
  const needle = trackedDomain.toLowerCase().replace(/^www\./, '');
  return results.find((r) => r.link.toLowerCase().includes(needle)) ?? null;
}

/**
 * Derives a volume estimate from the keyword string length and a seed.
 * Replace with a real keyword volume API (e.g., DataForSEO Keywords Data)
 * when available — this is purely a display placeholder.
 */
function estimateVolume(keyword: string): number {
  const seed = keyword.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const brackets = [200, 400, 800, 1200, 2400, 5000, 9900];
  return brackets[seed % brackets.length];
}

/**
 * Derives a difficulty estimate from the number of organic results returned
 * and the keyword's character count.
 * Replace with Semrush / Ahrefs / DataForSEO KD endpoint when available.
 */
function estimateDifficulty(resultCount: number, keyword: string): number {
  const base = resultCount >= 10 ? 60 : resultCount >= 7 ? 45 : 30;
  const jitter = keyword.length % 20;
  return Math.min(base + jitter, 95);
}

// --- API call ---

async function serpSearch(keyword: string, gl: string): Promise<SerpOrganic[]> {
  const key = import.meta.env.VITE_SERPAPI_KEY;
  const params = new URLSearchParams({
    q:       keyword,
    engine:  'google',
    api_key: key,
    num:     '10',
    ...(gl ? { gl } : {}),
  });
  const res = await fetch(`${SERPAPI_BASE}?${params}`);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${res.statusText}`);
  const data = await res.json() as SerpResponse;
  if (data.error) throw new Error(`SerpAPI error: ${data.error}`);
  return data.organic_results ?? [];
}

// --- Public API ---

/**
 * Fetches the live Google SERP for a keyword+location and finds where
 * the tracked domain appears.
 *
 * @param keyword       - The search query (e.g. "seo tools")
 * @param location      - Dashboard location string (e.g. "US", "India - Mumbai")
 * @param trackedDomain - Your site's domain (e.g. "mybrand.com").
 *                        When provided, rank = your position in Google.
 *                        When omitted, rank = position of the #1 result (always 1).
 *
 * rank = 0 means the tracked domain was not found in the top 10 results.
 */
export async function fetchKeywordRanking(
  keyword: string,
  location: string,
  trackedDomain = '',
): Promise<RankingResult> {
  const gl      = toGl(location);
  const results = await serpSearch(keyword, gl);

  // Find where the tracked domain appears, if provided
  const domainMatch = findDomainRank(results, trackedDomain);

  // Determine the result to display for rank/url/title:
  //   - domainMatch  → show your domain's rank
  //   - no match but domain was specified → rank 0 (not in top 10)
  //   - no domain specified → fall back to #1 result
  const displayResult = domainMatch ?? (trackedDomain ? null : results[0]);
  const inTopTen      = !!domainMatch;

  // Top 5 organic results for the "SERP Leaders" expandable section
  const serpResults: SerpItem[] = results.slice(0, 5).map((r) => ({
    rank:   r.position,
    title:  r.title,
    url:    r.link,
    domain: extractDomain(r.link),
  }));

  return {
    keyword,
    location,
    rank:        displayResult?.position ?? 0,
    url:         displayResult?.link     ?? '',
    title:       displayResult?.title    ?? '',
    change:      0,
    volume:      estimateVolume(keyword),
    difficulty:  estimateDifficulty(results.length, keyword),
    serpResults,
    inTopTen,
    fetchedAt:   new Date().toISOString(),
  };
}

/**
 * Refreshes rankings for multiple keywords in parallel.
 * Returns a map of keyword → RankingResult for easy merging.
 * Used by the "Refresh Data" button in SeoSuitePanel.
 *
 * @param trackedDomain - Your site's domain, passed to every fetchKeywordRanking call.
 */
export async function refreshAllRankings(
  keywords: { keyword: string; location: string; rank: number }[],
  trackedDomain = '',
): Promise<Map<string, RankingResult>> {
  const settled = await Promise.allSettled(
    keywords.map((k) => fetchKeywordRanking(k.keyword, k.location, trackedDomain)),
  );

  const map = new Map<string, RankingResult>();
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      const prev = keywords[i].rank;
      // change > 0 = moved up (e.g. rank went from 8 → 5, change = +3)
      // change < 0 = dropped
      // special case: if prev was 0 (not ranked), change stays 0
      r.value.change = prev > 0 ? prev - r.value.rank : 0;
      map.set(keywords[i].keyword, r.value);
    }
  });
  return map;
}
