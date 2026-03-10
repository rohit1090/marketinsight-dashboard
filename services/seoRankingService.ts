/**
 * seoRankingService.ts
 *
 * Fetches real Google SERP data for a keyword+location via SerpAPI and maps
 * it to the KeywordData shape used by SeoSuitePanel's Rankings table.
 *
 * Uses full SerpAPI location parameters:
 *   engine, q, location, google_domain, hl, gl, api_key, num
 */

const SERPAPI_BASE = '/api/serpapi/search.json';

// ─── Location config ─────────────────────────────────────────────────────────

export interface LocationConfig {
  location:     string;   // SerpAPI location string  e.g. "Bangalore Division, Karnataka, India"
  google_domain: string;  // e.g. "google.co.in"
  hl:           string;   // interface language       e.g. "en"
  gl:           string;   // country code             e.g. "in"
}

/** Maps UI location labels → SerpAPI location parameters */
const LOCATION_CONFIGS: Record<string, LocationConfig> = {
  // ── Global / Western ──────────────────────────────────────────────────────
  'Global': { location: '',                gl: '',   google_domain: 'google.com',    hl: 'en' },
  'US':     { location: 'United States',   gl: 'us', google_domain: 'google.com',    hl: 'en' },
  'UK':     { location: 'United Kingdom',  gl: 'gb', google_domain: 'google.co.uk',  hl: 'en' },
  'CA':     { location: 'Canada',          gl: 'ca', google_domain: 'google.ca',     hl: 'en' },
  'AU':     { location: 'Australia',       gl: 'au', google_domain: 'google.com.au', hl: 'en' },
  'DE':     { location: 'Germany',         gl: 'de', google_domain: 'google.de',     hl: 'de' },
  'FR':     { location: 'France',          gl: 'fr', google_domain: 'google.fr',     hl: 'fr' },
  'India':  { location: 'India',          gl: 'in', google_domain: 'google.co.in', hl: 'en' },

  // ── India — States ────────────────────────────────────────────────────────
  'India - Andhra Pradesh':             { location: 'Andhra Pradesh, India',             gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Arunachal Pradesh':          { location: 'Arunachal Pradesh, India',          gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Assam':                      { location: 'Assam, India',                      gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Bihar':                      { location: 'Bihar, India',                      gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Chhattisgarh':               { location: 'Chhattisgarh, India',               gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Goa':                        { location: 'Goa, India',                        gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Gujarat':                    { location: 'Gujarat, India',                    gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Haryana':                    { location: 'Haryana, India',                    gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Himachal Pradesh':           { location: 'Himachal Pradesh, India',           gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Jharkhand':                  { location: 'Jharkhand, India',                  gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Karnataka':                  { location: 'Karnataka, India',                  gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Kerala':                     { location: 'Kerala, India',                     gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Madhya Pradesh':             { location: 'Madhya Pradesh, India',             gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Maharashtra':                { location: 'Maharashtra, India',                gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Manipur':                    { location: 'Manipur, India',                    gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Meghalaya':                  { location: 'Meghalaya, India',                  gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Mizoram':                    { location: 'Mizoram, India',                    gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Nagaland':                   { location: 'Nagaland, India',                   gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Odisha':                     { location: 'Odisha, India',                     gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Punjab':                     { location: 'Punjab, India',                     gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Rajasthan':                  { location: 'Rajasthan, India',                  gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Sikkim':                     { location: 'Sikkim, India',                     gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Tamil Nadu':                 { location: 'Tamil Nadu, India',                 gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Telangana':                  { location: 'Telangana, India',                  gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Tripura':                    { location: 'Tripura, India',                    gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Uttar Pradesh':              { location: 'Uttar Pradesh, India',              gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Uttarakhand':                { location: 'Uttarakhand, India',                gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - West Bengal':                { location: 'West Bengal, India',                gl: 'in', google_domain: 'google.co.in', hl: 'en' },

  // ── India — Union Territories ─────────────────────────────────────────────
  'India - Andaman and Nicobar Islands':                    { location: 'Andaman and Nicobar Islands, India', gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Chandigarh':                                     { location: 'Chandigarh, India',                  gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Dadra and Nagar Haveli and Daman and Diu':       { location: 'Daman and Diu, India',               gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Delhi':                                          { location: 'Delhi, India',                       gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Jammu and Kashmir':                              { location: 'Jammu and Kashmir, India',           gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Ladakh':                                         { location: 'Ladakh, India',                      gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Lakshadweep':                                    { location: 'Lakshadweep, India',                 gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Puducherry':                                     { location: 'Puducherry, India',                  gl: 'in', google_domain: 'google.co.in', hl: 'en' },

  // ── India — Major Cities (with exact SerpAPI location strings) ────────────
  'India - Mumbai':           { location: 'Mumbai, Maharashtra, India',                      gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Bangalore':        { location: 'Bangalore Division, Karnataka, India',            gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Hyderabad':        { location: 'Hyderabad, Telangana, India',                     gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Ahmedabad':        { location: 'Ahmedabad, Gujarat, India',                       gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Chennai':          { location: 'Chennai, Tamil Nadu, India',                      gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Kolkata':          { location: 'Kolkata, West Bengal, India',                     gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Surat':            { location: 'Surat, Gujarat, India',                           gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Pune':             { location: 'Pune, Maharashtra, India',                        gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Jaipur':           { location: 'Jaipur, Rajasthan, India',                        gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Lucknow':          { location: 'Lucknow, Uttar Pradesh, India',                   gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Kanpur':           { location: 'Kanpur, Uttar Pradesh, India',                    gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Nagpur':           { location: 'Nagpur, Maharashtra, India',                      gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Indore':           { location: 'Indore, Madhya Pradesh, India',                   gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Thane':            { location: 'Thane, Maharashtra, India',                       gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Bhopal':           { location: 'Bhopal, Madhya Pradesh, India',                   gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Visakhapatnam':    { location: 'Visakhapatnam, Andhra Pradesh, India',            gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Pimpri-Chinchwad': { location: 'Pimpri-Chinchwad, Maharashtra, India',            gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Patna':            { location: 'Patna, Bihar, India',                             gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Vadodara':         { location: 'Vadodara, Gujarat, India',                        gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Ghaziabad':        { location: 'Ghaziabad, Uttar Pradesh, India',                 gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Ludhiana':         { location: 'Ludhiana, Punjab, India',                         gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Agra':             { location: 'Agra, Uttar Pradesh, India',                      gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Nashik':           { location: 'Nashik, Maharashtra, India',                      gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Faridabad':        { location: 'Faridabad, Haryana, India',                       gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Meerut':           { location: 'Meerut, Uttar Pradesh, India',                    gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Rajkot':           { location: 'Rajkot, Gujarat, India',                          gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Varanasi':         { location: 'Varanasi, Uttar Pradesh, India',                  gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Srinagar':         { location: 'Srinagar, Jammu and Kashmir, India',              gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Aurangabad':       { location: 'Aurangabad, Maharashtra, India',                  gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Dhanbad':          { location: 'Dhanbad, Jharkhand, India',                       gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Amritsar':         { location: 'Amritsar, Punjab, India',                         gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Navi Mumbai':      { location: 'Navi Mumbai, Maharashtra, India',                 gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Allahabad':        { location: 'Prayagraj, Uttar Pradesh, India',                 gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Howrah':           { location: 'Howrah, West Bengal, India',                      gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Ranchi':           { location: 'Ranchi, Jharkhand, India',                        gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Gwalior':          { location: 'Gwalior, Madhya Pradesh, India',                  gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Jabalpur':         { location: 'Jabalpur, Madhya Pradesh, India',                 gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Coimbatore':       { location: 'Coimbatore, Tamil Nadu, India',                   gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Vijayawada':       { location: 'Vijayawada, Andhra Pradesh, India',               gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Jodhpur':          { location: 'Jodhpur, Rajasthan, India',                       gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Madurai':          { location: 'Madurai, Tamil Nadu, India',                      gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Raipur':           { location: 'Raipur, Chhattisgarh, India',                     gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Kota':             { location: 'Kota, Rajasthan, India',                          gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Guwahati':         { location: 'Guwahati, Assam, India',                          gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Solapur':          { location: 'Solapur, Maharashtra, India',                     gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Hubballi-Dharwad': { location: 'Hubli-Dharwad, Karnataka, India',                 gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Bareilly':         { location: 'Bareilly, Uttar Pradesh, India',                  gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Moradabad':        { location: 'Moradabad, Uttar Pradesh, India',                 gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Mysore':           { location: 'Mysore, Karnataka, India',                        gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Gurgaon':          { location: 'Gurugram, Haryana, India',                        gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Aligarh':          { location: 'Aligarh, Uttar Pradesh, India',                   gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Jalandhar':        { location: 'Jalandhar, Punjab, India',                        gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Tiruchirappalli':  { location: 'Tiruchirappalli, Tamil Nadu, India',              gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Bhubaneswar':      { location: 'Bhubaneswar, Odisha, India',                      gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Salem':            { location: 'Salem, Tamil Nadu, India',                        gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Warangal':         { location: 'Warangal, Telangana, India',                      gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Thiruvananthapuram':{ location: 'Thiruvananthapuram, Kerala, India',              gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Guntur':           { location: 'Guntur, Andhra Pradesh, India',                   gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Bikaner':          { location: 'Bikaner, Rajasthan, India',                       gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Noida':            { location: 'Noida, Uttar Pradesh, India',                     gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Jamshedpur':       { location: 'Jamshedpur, Jharkhand, India',                    gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Cuttack':          { location: 'Cuttack, Odisha, India',                          gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Kochi':            { location: 'Kochi, Kerala, India',                            gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Nellore':          { location: 'Nellore, Andhra Pradesh, India',                  gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Dehradun':         { location: 'Dehradun, Uttarakhand, India',                    gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Jammu':            { location: 'Jammu, Jammu and Kashmir, India',                 gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Mangalore':        { location: 'Mangaluru, Karnataka, India',                     gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Erode':            { location: 'Erode, Tamil Nadu, India',                        gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Belgaum':          { location: 'Belagavi, Karnataka, India',                      gl: 'in', google_domain: 'google.co.in', hl: 'en' },
  'India - Udaipur':          { location: 'Udaipur, Rajasthan, India',                       gl: 'in', google_domain: 'google.co.in', hl: 'en' },
};

/** Returns the SerpAPI location config for a given display label.  */
export function toLocationConfig(label: string): LocationConfig {
  if (LOCATION_CONFIGS[label]) return LOCATION_CONFIGS[label];
  // Fallback for any "India - X" not explicitly mapped
  if (label.startsWith('India - ')) {
    const name = label.replace('India - ', '');
    return { location: `${name}, India`, gl: 'in', google_domain: 'google.co.in', hl: 'en' };
  }
  return { location: label, gl: 'us', google_domain: 'google.com', hl: 'en' };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RankingResult {
  keyword:     string;
  location:    string;
  rank:        number;
  url:         string;
  title:       string;
  change:      number;
  volume:      number;
  difficulty:  number;
  serpResults: SerpItem[];
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
}

interface SerpResponse {
  organic_results?: SerpOrganic[];
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function findDomainRank(results: SerpOrganic[], trackedDomain: string): SerpOrganic | null {
  if (!trackedDomain.trim()) return null;
  const needle = trackedDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '');
  return results.find((r) => r.link.toLowerCase().includes(needle)) ?? null;
}

function estimateVolume(keyword: string): number {
  const seed = keyword.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return [200, 400, 800, 1200, 2400, 5000, 9900][seed % 7];
}

function estimateDifficulty(resultCount: number, keyword: string): number {
  const base = resultCount >= 10 ? 60 : resultCount >= 7 ? 45 : 30;
  return Math.min(base + (keyword.length % 20), 95);
}

// ─── API call ─────────────────────────────────────────────────────────────────

async function serpSearch(keyword: string, cfg: LocationConfig): Promise<SerpOrganic[]> {
  const key = import.meta.env.VITE_SERPAPI_KEY;
  const params: Record<string, string> = {
    engine:  'google',
    q:       keyword,
    api_key: key,
    num:     '100',   // fetch up to 100 results so domains ranking beyond #10 are found
  };
  if (cfg.gl)            params.gl            = cfg.gl;
  if (cfg.location)      params.location      = cfg.location;
  if (cfg.google_domain) params.google_domain = cfg.google_domain;
  if (cfg.hl)            params.hl            = cfg.hl;

  const res = await fetch(`${SERPAPI_BASE}?${new URLSearchParams(params)}`);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${res.statusText}`);
  const data = await res.json() as SerpResponse;
  if (data.error) throw new Error(`SerpAPI error: ${data.error}`);
  return data.organic_results ?? [];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchKeywordRanking(
  keyword: string,
  location: string,
  trackedDomain = '',
): Promise<RankingResult> {
  const cfg     = toLocationConfig(location);
  const results = await serpSearch(keyword, cfg);

  const domainMatch   = findDomainRank(results, trackedDomain);
  const displayResult = domainMatch ?? (trackedDomain ? null : results[0]);
  const inTopTen      = !!domainMatch;

  // Top 10 + tracked domain entry (if ranked 11–100, append it so it's always visible)
  const top10 = results.slice(0, 10);
  const domainInTop10 = domainMatch && top10.some(r => r.link === domainMatch.link);
  const serpSlice = domainMatch && !domainInTop10 ? [...top10, domainMatch] : top10;

  const serpResults: SerpItem[] = serpSlice.map((r) => ({
    rank:   r.position,
    title:  r.title,
    url:    r.link,
    domain: extractDomain(r.link),
  }));

  return {
    keyword,
    location,
    rank:       displayResult?.position ?? 0,
    url:        displayResult?.link     ?? '',
    title:      displayResult?.title    ?? '',
    change:     0,
    volume:     estimateVolume(keyword),
    difficulty: estimateDifficulty(results.length, keyword),
    serpResults,
    inTopTen,
    fetchedAt:  new Date().toISOString(),
  };
}

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
      r.value.change = prev > 0 ? prev - r.value.rank : 0;
      map.set(keywords[i].keyword, r.value);
    }
  });
  return map;
}