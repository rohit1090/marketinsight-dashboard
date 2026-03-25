import { db } from '../firebase'
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore'

const BASE = '/api/proxy?service=dataforseo'

// ─── In-flight deduplication ──────────────────────────────────────────────────
const inFlightRequests = new Map<string, Promise<any>>()

// ─── Location codes ───────────────────────────────────────────────────────────

export const LOCATION_CODES: Record<string, number> = {
  // ── Global ──
  'Global': 2840,
  'US':     2840,
  'UK':     2826,
  'CA':     2124,
  'AU':     2036,
  'DE':     2276,
  'FR':     2250,

  // ── India country ──
  'India': 2356,

  // ── India states ──
  'India - Andhra Pradesh':             21200,
  'India - Arunachal Pradesh':          21201,
  'India - Assam':                      21202,
  'India - Bihar':                      21203,
  'India - Chhattisgarh':               21204,
  'India - Goa':                        21205,
  'India - Gujarat':                    21206,
  'India - Haryana':                    21207,
  'India - Himachal Pradesh':           21208,
  'India - Jharkhand':                  21209,
  'India - Karnataka':                  21210,
  'India - Kerala':                     21211,
  'India - Madhya Pradesh':             21212,
  'India - Maharashtra':                21213,
  'India - Manipur':                    21214,
  'India - Meghalaya':                  21215,
  'India - Mizoram':                    21216,
  'India - Nagaland':                   21217,
  'India - Odisha':                     21218,
  'India - Punjab':                     21219,
  'India - Rajasthan':                  21220,
  'India - Sikkim':                     21221,
  'India - Tamil Nadu':                 21222,
  'India - Telangana':                  21223,
  'India - Tripura':                    21224,
  'India - Uttar Pradesh':              21225,
  'India - Uttarakhand':                21226,
  'India - West Bengal':                21227,

  // ── India union territories ──
  'India - Andaman and Nicobar Islands':                    21228,
  'India - Chandigarh':                                     21229,
  'India - Dadra and Nagar Haveli and Daman and Diu':       21230,
  'India - Delhi':                                          21231,
  'India - Jammu and Kashmir':                              21232,
  'India - Ladakh':                                         21233,
  'India - Lakshadweep':                                    21234,
  'India - Puducherry':                                     21235,

  // ── India major cities ──
  'India - Mumbai':           1007786,
  'India - Bangalore':        1007766,
  'India - Hyderabad':        1007784,
  'India - Ahmedabad':        1007762,
  'India - Chennai':          1007780,
  'India - Kolkata':          1007783,
  'India - Surat':            1007795,
  'India - Pune':             1007788,
  'India - Jaipur':           1007800,
  'India - Lucknow':          1007785,
  'India - Kanpur':           1007801,
  'India - Nagpur':           1007787,
  'India - Indore':           1007802,
  'India - Thane':            1007796,
  'India - Bhopal':           1007803,
  'India - Visakhapatnam':    1007804,
  'India - Pimpri-Chinchwad': 1007805,
  'India - Patna':            1007806,
  'India - Vadodara':         1007797,
  'India - Ghaziabad':        1007807,
  'India - Ludhiana':         1007808,
  'India - Agra':             1007809,
  'India - Nashik':           1007810,
  'India - Faridabad':        1007811,
  'India - Meerut':           1007812,
  'India - Rajkot':           1007813,
  'India - Varanasi':         1007814,
  'India - Srinagar':         1007815,
  'India - Aurangabad':       1007816,
  'India - Dhanbad':          1007817,
  'India - Amritsar':         1007818,
  'India - Navi Mumbai':      1007819,
  'India - Allahabad':        1007820,
  'India - Howrah':           1007821,
  'India - Ranchi':           1007822,
  'India - Gwalior':          1007823,
  'India - Jabalpur':         1007824,
  'India - Coimbatore':       1007825,
  'India - Vijayawada':       1007826,
  'India - Jodhpur':          1007827,
  'India - Madurai':          1007828,
  'India - Raipur':           1007829,
  'India - Kota':             1007830,
  'India - Guwahati':         1007831,
  'India - Solapur':          1007832,
  'India - Hubballi-Dharwad': 1007833,
  'India - Bareilly':         1007834,
  'India - Moradabad':        1007835,
  'India - Mysore':           1007836,
  'India - Gurgaon':          1007837,
  'India - Aligarh':          1007838,
  'India - Jalandhar':        1007839,
  'India - Tiruchirappalli':  1007840,
  'India - Bhubaneswar':      1007841,
  'India - Salem':            1007842,
  'India - Warangal':         1007843,
  'India - Thiruvananthapuram': 1007844,
  'India - Guntur':           1007845,
  'India - Bikaner':          1007846,
  'India - Noida':            1007847,
  'India - Jamshedpur':       1007848,
  'India - Cuttack':          1007849,
  'India - Kochi':            1007850,
  'India - Nellore':          1007851,
  'India - Dehradun':         1007852,
  'India - Jammu':            1007853,
  'India - Mangalore':        1007854,
  'India - Erode':            1007855,
  'India - Belgaum':          1007856,
  'India - Udaipur':          1007857,
  'India - Maheshtala':       1007858,
}

const CITY_TO_STATE: Record<string, string> = {
  'India - Bangalore':         'India - Karnataka',
  'India - Mysore':            'India - Karnataka',
  'India - Hubballi-Dharwad':  'India - Karnataka',
  'India - Belgaum':           'India - Karnataka',
  'India - Mangalore':         'India - Karnataka',
  'India - Mumbai':            'India - Maharashtra',
  'India - Pune':              'India - Maharashtra',
  'India - Nagpur':            'India - Maharashtra',
  'India - Nashik':            'India - Maharashtra',
  'India - Thane':             'India - Maharashtra',
  'India - Aurangabad':        'India - Maharashtra',
  'India - Solapur':           'India - Maharashtra',
  'India - Pimpri-Chinchwad':  'India - Maharashtra',
  'India - Navi Mumbai':       'India - Maharashtra',
  'India - Maheshtala':        'India - West Bengal',
  'India - Chennai':           'India - Tamil Nadu',
  'India - Coimbatore':        'India - Tamil Nadu',
  'India - Madurai':           'India - Tamil Nadu',
  'India - Salem':             'India - Tamil Nadu',
  'India - Tiruchirappalli':   'India - Tamil Nadu',
  'India - Erode':             'India - Tamil Nadu',
  'India - Hyderabad':         'India - Telangana',
  'India - Warangal':          'India - Telangana',
  'India - Noida':             'India - Uttar Pradesh',
  'India - Ghaziabad':         'India - Uttar Pradesh',
  'India - Lucknow':           'India - Uttar Pradesh',
  'India - Agra':              'India - Uttar Pradesh',
  'India - Kanpur':            'India - Uttar Pradesh',
  'India - Varanasi':          'India - Uttar Pradesh',
  'India - Bareilly':          'India - Uttar Pradesh',
  'India - Allahabad':         'India - Uttar Pradesh',
  'India - Meerut':            'India - Uttar Pradesh',
  'India - Moradabad':         'India - Uttar Pradesh',
  'India - Aligarh':           'India - Uttar Pradesh',
  'India - Kolkata':           'India - West Bengal',
  'India - Howrah':            'India - West Bengal',
  'India - Ahmedabad':         'India - Gujarat',
  'India - Surat':             'India - Gujarat',
  'India - Vadodara':          'India - Gujarat',
  'India - Rajkot':            'India - Gujarat',
  'India - Jaipur':            'India - Rajasthan',
  'India - Jodhpur':           'India - Rajasthan',
  'India - Udaipur':           'India - Rajasthan',
  'India - Bikaner':           'India - Rajasthan',
  'India - Kota':              'India - Rajasthan',
  'India - Patna':             'India - Bihar',
  'India - Dhanbad':           'India - Jharkhand',
  'India - Ranchi':            'India - Jharkhand',
  'India - Jamshedpur':        'India - Jharkhand',
  'India - Bhopal':            'India - Madhya Pradesh',
  'India - Indore':            'India - Madhya Pradesh',
  'India - Gwalior':           'India - Madhya Pradesh',
  'India - Jabalpur':          'India - Madhya Pradesh',
  'India - Raipur':            'India - Chhattisgarh',
  'India - Visakhapatnam':     'India - Andhra Pradesh',
  'India - Vijayawada':        'India - Andhra Pradesh',
  'India - Guntur':            'India - Andhra Pradesh',
  'India - Nellore':           'India - Andhra Pradesh',
  'India - Kochi':             'India - Kerala',
  'India - Thiruvananthapuram':'India - Kerala',
  'India - Ludhiana':          'India - Punjab',
  'India - Amritsar':          'India - Punjab',
  'India - Jalandhar':         'India - Punjab',
  'India - Faridabad':         'India - Haryana',
  'India - Gurgaon':           'India - Haryana',
  'India - Dehradun':          'India - Uttarakhand',
  'India - Guwahati':          'India - Assam',
  'India - Bhubaneswar':       'India - Odisha',
  'India - Cuttack':           'India - Odisha',
  'India - Srinagar':          'India - Jammu and Kashmir',
  'India - Jammu':             'India - Jammu and Kashmir',
  'India - Chandigarh':        'India - Chandigarh',
}

export function getLocationCode(locationName: string): number {
  if (LOCATION_CODES[locationName]) return LOCATION_CODES[locationName]

  const stateName = CITY_TO_STATE[locationName]
  if (stateName && LOCATION_CODES[stateName]) {
    console.log(`[DFS] City "${locationName}" not found, falling back to state: ${stateName}`)
    return LOCATION_CODES[stateName]
  }

  console.log(`[DFS] Location "${locationName}" not found, falling back to India`)
  return 2356
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function getCachedData(key: string): Promise<any | null> {
  try {
    const safeKey = key.replace(/[^a-z0-9_]/gi, '_').slice(0, 100)
    const ref = doc(db, 'dfsCache', safeKey)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const { data, expiresAt } = snap.data()
    if (Date.now() > expiresAt) return null
    return data
  } catch { return null }
}

async function cacheData(key: string, data: any, ttlHours: number): Promise<void> {
  try {
    const cleanData = JSON.parse(
      JSON.stringify(data, (_, v) => v === undefined ? null : v)
    )
    const safeKey = key.replace(/[^a-z0-9_]/gi, '_').slice(0, 100)
    const ref = doc(db, 'dfsCache', safeKey)
    await setDoc(ref, {
      data: cleanData,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttlHours * 3_600_000,
    })
  } catch (e: any) {
    console.warn('DFS cache write failed:', e.message)
  }
}

function calculateSentiment(mentions: any[]): number {
  if (!mentions.length) return 0
  const pos = ['best', 'great', 'excellent', 'top', 'recommend', 'good', 'amazing']
  const neg = ['bad', 'worst', 'avoid', 'poor', 'terrible', 'scam', 'fake']
  let score = 50
  for (const m of mentions) {
    const text = (m.content || '').toLowerCase()
    pos.forEach(w => { if (text.includes(w)) score += 5 })
    neg.forEach(w => { if (text.includes(w)) score -= 5 })
  }
  return Math.max(0, Math.min(100, score))
}

export { getCachedData, cacheData }

// Delete all cache entries whose key contains the keyword slug
export async function clearKeywordCache(keyword: string): Promise<void> {
  try {
    const slug = keyword.toLowerCase().replace(/\s+/g, '_')
    const snap = await getDocs(collection(db, 'dfsCache'))
    const toDelete = snap.docs.filter(d => d.id.includes(slug))
    await Promise.all(toDelete.map(d => deleteDoc(d.ref)))
    console.log(`[DFS] Cleared ${toDelete.length} cache entries for "${keyword}":`, toDelete.map(d => d.id))
  } catch (e: any) {
    console.warn('[DFS] Cache clear failed:', e.message)
  }
}

// ─── Base request ─────────────────────────────────────────────────────────────

async function dfsRequest(endpoint: string, payload: object): Promise<any> {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, payload }),
  })

  const text = await response.text()

  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`DataForSEO invalid response: ${text.slice(0, 100)}`)
  }

  if (!response.ok) {
    throw new Error(data.error || data.hint || `HTTP ${response.status}`)
  }

  return data
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SerpResult {
  rank: number
  url: string
  title: string
  snippet: string
  domain: string
  hasAiOverview: boolean
  aiOverviewText?: string
  aiOverviewCitesYou?: boolean
  featuredSnippet?: string
}

export interface KeywordAdsData {
  keyword: string
  searchVolume: number
  cpc: number | null
  lowTopOfPageBid: number | null
  highTopOfPageBid: number | null
  competition: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' | 'NO DATA'
  competitionIndex: number
  monthlySearches: { year: number; month: number; searchVolume: number }[]
  categories: string[]
  keywordAnnotations: string[]
  hasData: boolean
  locationFallback?: string
}

export interface DomainMetrics {
  domain: string
  rank: number
  backlinks: number
  referringDomains: number
  brokenBacklinks: number
  referringIps: number
  spamScore: number
}

export interface CompetitorDomain {
  domain: string
  organicKeywords: number
  organicTraffic: number
  commonKeywords: number
  competitionLevel: number
  avgPosition: number
}

export interface DomainTrafficData {
  domain: string
  organicKeywords: number
  organicTraffic: number
  paidKeywords: number
  paidTraffic: number
  paidTrafficCost: number
  rank: number
}

export interface LLMVisibility {
  platform: string
  visibility: number
  sentiment: number
  topicsCount: number
  mentionCount: number
}

// ─── Location code lookup via DataForSEO API ──────────────────────────────────

const COUNTRY_ISO: Record<string, string> = {
  'India': 'IN', 'Global': 'US', 'US': 'US', 'UK': 'GB',
  'CA': 'CA', 'AU': 'AU', 'DE': 'DE', 'FR': 'FR',
}

async function resolveLocationCode(locationName: string): Promise<number> {
  // Fast path: hardcoded map covers all common cases
  if (LOCATION_CODES[locationName]) return LOCATION_CODES[locationName]

  // Check Firestore cache (30 days)
  const locCacheKey = `loc_${locationName.replace(/[^a-z0-9]/gi, '_')}`
  const locCached = await getCachedData(locCacheKey)
  if (locCached?.code) {
    console.log(`[DFS] Location code (cache) "${locationName}" → ${locCached.code}`)
    return locCached.code
  }

  // Determine country ISO for API call
  const parts = locationName.split(' - ')               // e.g. ["India", "Bangalore"]
  const countryName = parts[0].trim()
  const cityName    = parts[1]?.trim() ?? ''
  const iso = COUNTRY_ISO[countryName] ?? 'IN'

  try {
    const res = await fetch(`/api/proxy?service=dataforseo-locations&country=${iso}`)
    const locations: any[] = await res.json()

    const needle = cityName.toLowerCase()

    // 1. Exact city match
    const exactCity = locations.find(
      (l: any) => l.location_name?.toLowerCase() === needle && l.location_type === 'City'
    )
    // 2. Exact state/region match (city not found)
    const exactState = !exactCity
      ? locations.find(
          (l: any) => l.location_name?.toLowerCase() === needle &&
            (l.location_type === 'State' || l.location_type === 'Region')
        )
      : undefined
    // 3. Country fallback (neither city nor state found)
    const countryFallback = !exactCity && !exactState
      ? locations.find((l: any) => l.country_iso_code === iso && l.location_type === 'Country')
      : undefined

    const match = exactCity ?? exactState ?? countryFallback
    const code: number = match?.location_code ?? LOCATION_CODES[countryName] ?? 2356
    const matchType = exactCity ? 'city' : exactState ? 'state' : countryFallback ? 'country' : 'hardcoded fallback'
    console.log(`[DFS] Location code "${locationName}" → ${code} via ${matchType} (${match?.location_name ?? 'n/a'})`)

    await cacheData(locCacheKey, { code }, 720) // 30 days
    return code
  } catch {
    console.warn(`[DFS] Location API failed for "${locationName}", using hardcoded fallback`)
    return getLocationCode(locationName)
  }
}

// ─── Function 1: Google SERP Rankings (Priority Queue) ────────────────────────

export async function getSerpRankings(
  keyword: string,
  targetDomain: string,
  locationName: string = 'India',
  forceRefresh: boolean = false,
  onStatus?: (msg: string) => void,
): Promise<{
  yourPosition: number | null
  results: SerpResult[]
  aiOverview: any
  featuredSnippet: any
  relatedSearches: string[]
}> {
  const notify = (msg: string) => {
    console.log(`[DFS] ${msg}`)
    onStatus?.(msg)
  }

  const cacheKey = `serp_${keyword.replace(/\s+/g, '_')}_${locationName}`

  // ── Step 1: Cache check ────────────────────────────────────────────────────
  if (!forceRefresh) {
    const cached = await getCachedData(cacheKey)
    if (cached && Array.isArray(cached.results) && cached.results.length > 0) {
      notify(`Cache hit → "${keyword}" @ ${locationName}`)
      return cached
    }
    notify(cached ? `Cache invalid (empty) → re-fetching` : `Cache miss → "${keyword}"`)
  } else {
    notify(`Force refresh → "${keyword}" @ ${locationName}`)
  }

  // ── Step 2: Resolve location code ─────────────────────────────────────────
  const locationCode = await resolveLocationCode(locationName)
  console.log(`[DFS SERP] Keyword: ${keyword} | Location: ${locationName} | Code: ${locationCode}`)

  // Normalize domain for matching
  const domainNeedle = targetDomain
    ? targetDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase()
    : ''

  let allResults: SerpResult[] = []
  let aiOverview: any = null
  let featuredSnippet: any = null
  let relatedSearches: string[] = []
  let yourPosition: number | null = null

  function parseItems(items: any[]): void {
    let organicRank = 0
    const newResults: SerpResult[] = []
    for (const item of items) {
      if (item.type === 'organic') {
        organicRank++
        newResults.push({
          rank: organicRank,
          url: item.url || '',
          title: item.title || '',
          snippet: item.description || '',
          domain: item.domain || '',
          hasAiOverview: false,
        })
        if (domainNeedle && yourPosition === null && (
          item.domain?.toLowerCase().includes(domainNeedle) ||
          item.url?.toLowerCase().includes(domainNeedle)
        )) {
          yourPosition = organicRank
        }
      }
      if (item.type === 'ai_overview' && !aiOverview) {
        aiOverview = {
          text: item.text || '',
          references: item.references || [],
          citesTargetDomain: item.references?.some((r: any) => r.url?.includes(targetDomain)) || false,
        }
      }
      if (item.type === 'featured_snippet' && !featuredSnippet) {
        featuredSnippet = { text: item.description || '', url: item.url || '', domain: item.domain || '' }
      }
      if (item.type === 'related_searches') {
        relatedSearches = item.items?.map((r: any) => r.title) || []
      }
    }
    allResults = newResults
  }

  // ── Step 3: Two-round Priority Queue (depth 10 → depth 30, skip depth 20) ─
  // Round 1: depth 10 ($0.0012) — stop if found
  // Round 2: depth 30 ($0.0030) — only if not found in top 10
  // Max 2 tasks per keyword. Never run depth 20.
  const POLL_INTERVAL_MS = 10_000   // 10s — priority queue responds in ~1 min
  const MAX_ATTEMPTS     = 12       // 2 min max wait per round

  async function runSerpTask(depth: number): Promise<any[]> {
    const postData = await dfsRequest('/v3/serp/google/organic/task_post', {
      keyword,
      location_code: locationCode,
      language_code: 'en',
      device: 'desktop',
      os: 'windows',
      depth,
      priority: 2,
    })
    const taskId: string | undefined = postData[0]?.id
    if (!taskId) throw new Error(`[DFS] No task ID returned for depth ${depth}`)
    console.log(`[DFS] Priority task created: ${taskId} (depth ${depth})`)

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      notify(`Processing... checking in 10s (attempt ${attempt}/${MAX_ATTEMPTS})`)
      try {
        const res = await fetch('/api/proxy?service=dataforseo-get', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: `/v3/serp/google/organic/task_get/advanced/${taskId}`,
          }),
        })
        const pollData = await res.json()
        const status   = pollData[0]?.status_code
        if (status === 20000) {
          const items = pollData[0]?.result?.[0]?.items || []
          console.log(`[DFS] Depth ${depth} task complete — ${items.length} items`)
          return items
        }
        if (status === 40602) {
          notify(`Still processing... (attempt ${attempt}/${MAX_ATTEMPTS})`)
          continue
        }
        throw new Error(`Task error ${status}: ${pollData[0]?.status_message}`)
      } catch (pollErr: any) {
        console.warn(`[DFS] Poll attempt ${attempt} error:`, pollErr.message)
      }
    }
    throw new Error('SERP task timed out — please retry')
  }

  // Round 1 — depth 10
  notify('Checking top 10 results...')
  parseItems(await runSerpTask(10))

  if (yourPosition !== null) {
    notify(`Found at position #${yourPosition}`)
  } else {
    // Round 2 — depth 30 (skip depth 20 entirely)
    notify('Not in top 10, checking top 30...')
    parseItems(await runSerpTask(30))

    if (yourPosition !== null) {
      notify(`Found at position #${yourPosition}`)
    } else {
      notify('Not in top 30')
    }
  }

  notify(`Final position → ${yourPosition !== null ? `#${yourPosition}` : '>30'}`)

  // ── Step 4: Cache for 7 days ───────────────────────────────────────────────
  const result = { yourPosition, results: allResults, aiOverview, featuredSnippet, relatedSearches }
  await cacheData(cacheKey, result, 168)
  const expiresDate = new Date(Date.now() + 168 * 3_600_000).toLocaleDateString()
  console.log(`[DFS] Cached → "${keyword}" expires ${expiresDate}`)

  return result
}

// ─── Function 2: Google Ads / Search Volume (Standard Queue + batch) ─────────

function mapCompetition(value: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' {
  if (value === undefined || value === null) return 'UNKNOWN'
  if (value < 0.33) return 'LOW'
  if (value < 0.66) return 'MEDIUM'
  return 'HIGH'
}

// Always resolve to a country-level code — city/state level returns null from Google Ads API
function getCountryCode(locationName: string): number {
  if (locationName.startsWith('India')) return 2356
  if (locationName === 'US' || locationName === 'Global') return 2840
  if (locationName === 'UK') return 2826
  if (locationName === 'AU') return 2036
  if (locationName === 'CA') return 2124
  if (locationName === 'DE') return 2276
  if (locationName === 'FR') return 2250
  return 2356 // default
}

function mapAdsItems(items: any[]): KeywordAdsData[] {
  return items.map((item: any) => ({
    keyword:            item.keyword,
    searchVolume:       item.search_volume ?? 0,
    cpc:                item.cpc != null ? Number(item.cpc.toFixed(2)) : null,
    lowTopOfPageBid:    item.low_top_of_page_bid != null ? Number(item.low_top_of_page_bid.toFixed(2)) : null,
    highTopOfPageBid:   item.high_top_of_page_bid != null ? Number(item.high_top_of_page_bid.toFixed(2)) : null,
    competition:        (item.competition as 'LOW' | 'MEDIUM' | 'HIGH') ?? 'NO DATA',
    competitionIndex:   Number.isFinite(Math.round(item.competition_index || 0))
                          ? Math.round(item.competition_index || 0)
                          : 0,
    monthlySearches:    (item.monthly_searches || []).map((m: any) => ({
      year: m.year, month: m.month, searchVolume: m.search_volume ?? 0,
    })),
    categories:         item.categories || [],
    keywordAnnotations: item.keyword_annotations?.concepts?.map((c: any) => c.name) || [],
    hasData:            item.search_volume !== null && item.search_volume !== undefined,
  }))
}

// ── Ads batch queue (Fix 3) ───────────────────────────────────────────────────
// Collects all calls within a 2-second window and sends ONE task_post for all keywords.
// Google Ads accepts up to 1000 keywords per task at $0.05 flat — vastly cheaper than
// one task per keyword.

interface AdsBatchEntry {
  keywords:    string[]
  countryCode: number
  resolve:     (results: KeywordAdsData[]) => void
  reject:      (err: any) => void
}

const adsBatchQueue: AdsBatchEntry[]                    = []
let   adsBatchTimer: ReturnType<typeof setTimeout> | null = null

// Fix 2: In-memory lock — reuses an in-flight promise for the exact same keyword set,
// preventing duplicate API calls when the same keyword is added concurrently before
// the first call writes to cache.
const pendingAdsTasks = new Map<string, Promise<KeywordAdsData[]>>()

async function flushAdsBatch(): Promise<void> {
  adsBatchTimer = null
  const entries = adsBatchQueue.splice(0)   // drain all queued callers
  if (!entries.length) return

  // Group by countryCode (usually all the same)
  const groups = new Map<number, AdsBatchEntry[]>()
  for (const e of entries) {
    const g = groups.get(e.countryCode) ?? []
    g.push(e)
    groups.set(e.countryCode, g)
  }

  for (const [countryCode, groupEntries] of groups) {
    // Deduplicate keywords across all callers in this group
    const allKeywords = [...new Set(groupEntries.flatMap(e => e.keywords))]
    console.log(
      `[DFS Ads Batch] Sending ${allKeywords.length} keyword(s) as 1 task for ${groupEntries.length} caller(s)`,
      allKeywords,
    )

    try {
      // ── task_post ────────────────────────────────────────────────────────
      const postData = await dfsRequest('/v3/keywords_data/google_ads/search_volume/task_post', {
        keywords:      allKeywords,
        location_code: countryCode,
        language_code: 'en',
      })

      const taskId: string | undefined = postData[0]?.id
      if (!taskId) throw new Error('[DFS Ads] No task ID from task_post')
      console.log('[DFS Ads] Batch task created:', taskId)

      // ── poll task_get ─────────────────────────────────────────────────────
      const POLL_INTERVAL_MS = 20_000
      const MAX_ATTEMPTS     = 15
      let taskItems: any[] = []

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
        console.log(`[DFS Ads] Batch poll attempt ${attempt}/${MAX_ATTEMPTS}`)

        try {
          const res = await fetch('/api/proxy?service=dataforseo-get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: `/v3/keywords_data/google_ads/search_volume/task_get/${taskId}`,
            }),
          })
          const pollData = await res.json()
          const status   = pollData[0]?.status_code

          if (status === 20000) {
            taskItems = pollData[0]?.result || []
            console.log('[DFS Ads] Batch task complete —', taskItems.length, 'items')
            break
          }
          if (status === 40602) continue
          throw new Error(`Ads task error ${status}: ${pollData[0]?.status_message}`)
        } catch (pollErr: any) {
          console.warn(`[DFS Ads] Batch poll attempt ${attempt} error:`, pollErr.message)
        }
      }

      if (taskItems.length === 0) {
        throw new Error('Google Ads task timed out after 5 minutes — please retry')
      }

      const allResults = mapAdsItems(taskItems)

      // Cache the full batch result
      const batchKey = `ads_${[...allKeywords].sort().join('_').slice(0, 80)}_country_${countryCode}`
      await cacheData(batchKey, allResults, 168)

      // Distribute results to each caller and cache their individual slice
      for (const entry of groupEntries) {
        const slice = allResults.filter(r => entry.keywords.includes(r.keyword))
        const callerKey = `ads_${[...entry.keywords].sort().join('_').slice(0, 80)}_country_${countryCode}`
        if (callerKey !== batchKey) await cacheData(callerKey, slice, 168)
        entry.resolve(slice)
      }
    } catch (err) {
      for (const entry of groupEntries) entry.reject(err)
    }
  }
}

export async function getGoogleAdsData(
  keywords: string[],
  locationName: string = 'India',
  onStatus?: (msg: string) => void,
  forceRefresh: boolean = false,
): Promise<KeywordAdsData[]> {
  const notify = (msg: string) => { console.log(`[DFS Ads] ${msg}`); onStatus?.(msg) }

  // Always use country level — city/state granularity returns null (Google API limitation)
  const countryCode = getCountryCode(locationName)

  // Cache check with diagnostics
  const cacheKey = `ads_${[...keywords].sort().join('_').slice(0, 80)}_country_${countryCode}`
  const cached   = await getCachedData(cacheKey)
  console.log('[Cache] Key:', cacheKey)
  console.log('[Cache] Hit:', !!(cached && Array.isArray(cached) && cached.length > 0))
  console.log('[Cache] Age:', cached ? '<7d (valid, exact age stored server-side)' : 'N/A')

  // Invalidate cache if it's missing new fields (lowTopOfPageBid/highTopOfPageBid added after initial cache write)
  const cacheHasNewFields = Array.isArray(cached) && cached.length > 0 && 'lowTopOfPageBid' in (cached[0] ?? {})
  if (!forceRefresh && cacheHasNewFields && cached.some((r: any) => r.hasData)) {
    console.log('[Cache] Returning cached data, skipping API')
    notify('Cache hit — returning volume data')
    return cached
  }
  if (cached && !cacheHasNewFields) console.log('[Cache] Invalidated — missing new fields, re-fetching')
  if (forceRefresh) notify('Force refresh — bypassing cache')
  console.log('[Cache] No cache found, calling API')
  if (cached) notify('Cache invalid (no hasData items) — re-fetching')

  // Fix 2: Reuse in-flight promise for the same keyword set (prevents duplicate tasks
  // when called concurrently before the cache write from the first call completes)
  const lockKey = [...keywords].sort().join('|') + `_${countryCode}`
  if (pendingAdsTasks.has(lockKey)) {
    console.log('[DFS Ads] Reusing in-flight promise for:', keywords)
    return pendingAdsTasks.get(lockKey)!
  }

  notify('Fetching volume data... (standard queue ~5 min)')

  // Fix 3: Enqueue into 2-second batch window — multiple keywords become ONE task_post
  const promise = new Promise<KeywordAdsData[]>((resolve, reject) => {
    adsBatchQueue.push({ keywords, countryCode, resolve, reject })
    if (!adsBatchTimer) {
      adsBatchTimer = setTimeout(() => flushAdsBatch(), 2000)
      console.log('[DFS Ads] Batch timer started — waiting 2s for more keywords')
    }
  })

  pendingAdsTasks.set(lockKey, promise)
  promise.finally(() => pendingAdsTasks.delete(lockKey))

  return promise
}

// ─── Function 2b: Ranked Keywords (live, cached 7 days) ──────────────────────

export interface RankedKeyword {
  keyword: string
  url: string
  rank: number
  trafficPercent: number
  searchVolume: number
  cpc: number | null
  competition: string
  // enriched fields
  keywordDifficulty: number | null
  searchIntent: string | null
  foreignIntent: string[] | null
  rankChange: {
    previousRank: number | null
    isNew: boolean
    isUp: boolean
    isDown: boolean
  }
  backlinks: {
    count: number | null
    referringDomains: number | null
    dofollow: number | null
  } | null
  avgBacklinks: {
    count: number | null
    referringDomains: number | null
    rank: number | null
    mainDomainRank: number | null
  } | null
  volumeTrend: {
    monthly: number | null
    quarterly: number | null
    yearly: number | null
  } | null
  serpFeatures: string[]
  itemType: string
}

export interface RankedKeywordsMetricSection {
  pos_1: number
  pos_2_3: number
  pos_4_10: number
  pos_11_20: number
  pos_21_30: number
  pos_31_40: number
  pos_41_50: number
  pos_51_60: number
  pos_61_70: number
  pos_71_80: number
  pos_81_90: number
  pos_91_100: number
  etv: number
  count: number
  estimated_paid_traffic_cost: number
  is_new: number
  is_lost: number
  is_up: number
  is_down: number
}

export interface RankedKeywordsMetrics {
  organic:            RankedKeywordsMetricSection | null
  paid:               RankedKeywordsMetricSection | null
  featuredSnippet:    RankedKeywordsMetricSection | null
  localPack:          RankedKeywordsMetricSection | null
  aiOverviewReference:RankedKeywordsMetricSection | null
}

export async function getRankedKeywords(
  domain: string,
  forceRefresh: boolean = false,
  limit: 50 | 100 = 50,
): Promise<{ items: RankedKeyword[]; metrics: RankedKeywordsMetrics | null; cachedAt: number | null; totalCount: number }> {
  const slug     = domain.replace(/[^a-z0-9]/gi, '_')
  const cacheKey = `ranked_kw_${slug}_${limit}`

  // Deduplicate ALL concurrent calls for the same key — even force-refresh ones.
  // The first caller wins; subsequent concurrent calls wait for the same promise.
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!
  }

  const promise = (async () => {
    if (!forceRefresh) {
      const cached = await getCachedData(cacheKey)
      if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
        // Auto-invalidate if cached objects predate the enriched fields
        if (cached.items[0].keywordDifficulty === undefined) {
          console.log(`[DFS RankedKw] Stale cache (missing enriched fields) → re-fetching ${domain}`)
        } else {
          console.log(`[DFS RankedKw] Cache hit → ${domain} limit=${limit} (${cached.items.length} items)`)
          return { items: cached.items, metrics: cached.metrics ?? null, cachedAt: cached.cachedAt ?? null, totalCount: cached.totalCount ?? 0 }
        }
      } else {
        console.log(`[DFS RankedKw] Cache miss → ${domain} limit=${limit}`)
      }
    } else {
      console.log(`[DFS RankedKw] Force refresh → ${domain} limit=${limit}`)
    }

    // First batch: offset 0, limit 50. Second batch: offset 50, limit 50.
    const isSecondBatch = limit === 100
    const payload: Record<string, any> = {
      target:        domain,
      language_code: 'en',
      limit:         50,
      order_by:      ['ranked_serp_element.serp_item.etv,desc'],
    }
    if (isSecondBatch) payload.offset = 50

    const response = await fetch('/api/proxy?service=dataforseo-ranked-keywords', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        endpoint: '/v3/dataforseo_labs/google/ranked_keywords/live',
        payload,
      }),
    })

    const tasks = await response.json()
    if (!response.ok) throw new Error(tasks.error || `HTTP ${response.status}`)

    const taskStatus = tasks[0]?.status_code
    const taskMsg    = tasks[0]?.status_message
    if (taskStatus && taskStatus !== 20000) {
      throw new Error(`DataForSEO task error ${taskStatus}: ${taskMsg}`)
    }

    console.log('[DFS RankedKw] Raw task result:', JSON.stringify(tasks[0]?.result?.[0]).slice(0, 300))

    const result0    = tasks[0]?.result?.[0] ?? {}
    const rawItems: any[] = result0.items ?? []
    const totalCount: number = result0.total_count ?? 0

    const items: RankedKeyword[] = rawItems.map((item: any) => {
      const serpItem   = item.ranked_serp_element?.serp_item
      const kwInfo     = item.keyword_data?.keyword_info
      const kwProps    = item.keyword_data?.keyword_properties
      const intentInfo = item.keyword_data?.search_intent_info
      const blInfo     = serpItem?.backlinks_info
      const avgBlInfo  = item.keyword_data?.avg_backlinks_info
      const rcInfo     = serpItem?.rank_changes

      return {
        keyword:        item.keyword_data?.keyword ?? '',
        url:            serpItem?.url ?? '',
        rank:           serpItem?.rank_absolute ?? 0,
        trafficPercent: serpItem?.etv ?? 0,
        searchVolume:   kwInfo?.search_volume ?? 0,
        cpc:            kwInfo?.cpc ?? null,
        competition:    kwInfo?.competition_level ?? kwInfo?.competition ?? '',
        // enriched
        keywordDifficulty: item.ranked_serp_element?.keyword_difficulty ?? kwProps?.keyword_difficulty ?? null,
        searchIntent:      intentInfo?.main_intent ?? null,
        foreignIntent:     intentInfo?.foreign_intent ?? null,
        rankChange: {
          previousRank: rcInfo?.previous_rank_absolute ?? null,
          isNew:        rcInfo?.is_new  ?? false,
          isUp:         rcInfo?.is_up   ?? false,
          isDown:       rcInfo?.is_down ?? false,
        },
        backlinks: blInfo ? {
          count:            blInfo.backlinks         ?? null,
          referringDomains: blInfo.referring_domains ?? null,
          dofollow:         blInfo.dofollow          ?? null,
        } : null,
        avgBacklinks: avgBlInfo ? {
          count:            avgBlInfo.backlinks         ?? null,
          referringDomains: avgBlInfo.referring_domains ?? null,
          rank:             avgBlInfo.rank              ?? null,
          mainDomainRank:   avgBlInfo.main_domain_rank  ?? null,
        } : null,
        volumeTrend: kwInfo?.search_volume_trend ? {
          monthly:   kwInfo.search_volume_trend.monthly   ?? null,
          quarterly: kwInfo.search_volume_trend.quarterly ?? null,
          yearly:    kwInfo.search_volume_trend.yearly    ?? null,
        } : null,
        serpFeatures: item.ranked_serp_element?.serp_item_types ?? [],
        itemType:     serpItem?.type ?? 'organic',
      }
    })

    const rawMetrics = result0.metrics ?? null
    const metrics: RankedKeywordsMetrics | null = rawMetrics ? {
      organic:             rawMetrics.organic             ?? null,
      paid:                rawMetrics.paid                ?? null,
      featuredSnippet:     rawMetrics.featured_snippet    ?? null,
      localPack:           rawMetrics.local_pack          ?? null,
      aiOverviewReference: rawMetrics.ai_overview_reference ?? null,
    } : null

    if (items.length === 0) {
      console.warn(`[DFS RankedKw] API returned 0 items for ${domain} limit=${limit} — NOT caching`)
      return { items: [], metrics, cachedAt: null, totalCount }
    }

    const cachedAt = Date.now()
    await cacheData(cacheKey, { items, metrics, cachedAt, totalCount }, 168)
    console.log(`[DFS RankedKw] Fetched & cached ${items.length} keywords for ${domain} limit=${limit}`)
    return { items, metrics, cachedAt, totalCount }
  })()

  inFlightRequests.set(cacheKey, promise)
  try {
    return await promise
  } finally {
    inFlightRequests.delete(cacheKey)
  }
}

// ─── Historical Rank Overview ─────────────────────────────────────────────────

export interface DomainRankHistoryPoint {
  date: string               // "YYYY-MM" constructed from year+month integers
  organicKeywords: number
  organicTraffic: number
  organicTrafficValue: number
  paidKeywords: number
  paidTraffic: number
  isNew: number
  isUp: number
  isDown: number
  isLost: number
}

export async function getHistoricalRankData(
  domain: string,
  locationCode: number = 2840,
  forceRefresh = false,
): Promise<{ items: DomainRankHistoryPoint[]; cachedAt: number | null }> {
  const cacheKey = `hist_rank_${domain.replace(/[^a-z0-9]/gi, '_')}_${locationCode}`

  // Deduplicate concurrent calls with the same key
  if (!forceRefresh && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!
  }

  const promise = (async (): Promise<{ items: DomainRankHistoryPoint[]; cachedAt: number | null }> => {
    if (!forceRefresh) {
      const cached = await getCachedData(cacheKey)
      if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
        console.log(`[DFS HistRank] Cache hit → ${domain} (${cached.items.length} points)`)
        return { items: cached.items, cachedAt: cached.cachedAt ?? null }
      }
    }

    const response = await fetch('/api/proxy?service=dataforseo-historical-rank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: { target: domain, location_code: locationCode, language_code: 'en' },
      }),
    })

    // Proxy returns data.tasks[0].result (array) — result[0].items has per-month snapshots
    const resultArr = await response.json()
    if (!response.ok) throw new Error(resultArr.error || `HTTP ${response.status}`)

    const result0 = resultArr?.[0] ?? {}
    const rawItems: any[] = result0.items ?? []

    console.log(`[DFS HistRank] Raw items: ${rawItems.length}, first:`, JSON.stringify(rawItems[0]).slice(0, 200))

    // Items have year+month integers (NOT a date string) — build date from them
    const items: DomainRankHistoryPoint[] = rawItems
      .filter((item: any) => item.year && item.month)
      .map((item: any) => ({
        date:               `${item.year}-${String(item.month).padStart(2, '0')}`,
        organicKeywords:    Number(item.metrics?.organic?.count                       ?? 0),
        organicTraffic:     Number(item.metrics?.organic?.etv                         ?? 0),
        organicTrafficValue:Number(item.metrics?.organic?.estimated_paid_traffic_cost ?? 0),
        paidKeywords:       Number(item.metrics?.paid?.count                          ?? 0),
        paidTraffic:        Number(item.metrics?.paid?.etv                            ?? 0),
        isNew:              Number(item.metrics?.organic?.is_new                      ?? 0),
        isUp:               Number(item.metrics?.organic?.is_up                       ?? 0),
        isDown:             Number(item.metrics?.organic?.is_down                     ?? 0),
        isLost:             Number(item.metrics?.organic?.is_lost                     ?? 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    console.log('[DFS HistRank] Mapped points:', items.length, items)

    if (items.length > 0) {
      const cachedAt = Date.now()
      await cacheData(cacheKey, { items, cachedAt }, 168)
      return { items, cachedAt }
    }
    return { items: [], cachedAt: null }
  })()

  inFlightRequests.set(cacheKey, promise)
  try {
    return await promise
  } finally {
    inFlightRequests.delete(cacheKey)
  }
}

// ─── Function 3: Backlinks + Domain Metrics ───────────────────────────────────

export async function getBacklinkMetrics(domain: string): Promise<DomainMetrics> {
  const cacheKey = `backlinks_${domain}`
  const cached = await getCachedData(cacheKey)
  if (cached) return cached

  const data = await dfsRequest('/v3/backlinks/summary/live', {
    target: domain,
    include_subdomains: true,
  })

  const item = data[0]?.result?.[0] || {}
  const result: DomainMetrics = {
    domain,
    rank: item.rank || 0,
    backlinks: item.backlinks || 0,
    referringDomains: item.referring_domains || 0,
    brokenBacklinks: item.broken_backlinks || 0,
    referringIps: item.referring_ips || 0,
    spamScore: item.spam_score || 0,
  }

  await cacheData(cacheKey, result, 168)
  return result
}

// ─── Function 4: Competitor Domains ──────────────────────────────────────────

export async function getCompetitorDomains(
  domain: string,
  locationName: string = 'India',
): Promise<CompetitorDomain[]> {
  const cacheKey = `competitors_${domain}`
  const cached = await getCachedData(cacheKey)
  if (cached) return cached

  const locationCode = getLocationCode(locationName)

  const data = await dfsRequest('/v3/dataforseo_labs/google/competitors_domain/live', {
    target: domain,
    location_code: locationCode,
    language_code: 'en',
    limit: 10,
  })

  const results: CompetitorDomain[] = (data[0]?.result?.[0]?.items || []).map((item: any) => ({
    domain: item.domain,
    organicKeywords: item.organic_keywords || 0,
    organicTraffic: item.organic_traffic || 0,
    commonKeywords: item.intersections || 0,
    competitionLevel: Math.round(((item.intersections || 0) / (item.organic_keywords || 1)) * 100),
    avgPosition: item.avg_position || 0,
  }))

  await cacheData(cacheKey, results, 168)
  return results
}

// ─── Function 5: Domain Traffic Overview ─────────────────────────────────────

export async function getDomainTraffic(
  domain: string,
  locationName: string = 'India',
): Promise<DomainTrafficData> {
  const cacheKey = `traffic_${domain}`
  const cached = await getCachedData(cacheKey)
  if (cached) return cached

  const locationCode = getLocationCode(locationName)

  const data = await dfsRequest('/v3/dataforseo_labs/google/domain_rank_overview/live', {
    target: domain,
    location_code: locationCode,
    language_code: 'en',
  })

  const item = data[0]?.result?.[0]?.items?.[0] || {}
  const result: DomainTrafficData = {
    domain,
    organicKeywords: item.organic?.count || 0,
    organicTraffic: item.organic?.etv || 0,
    paidKeywords: item.paid?.count || 0,
    paidTraffic: item.paid?.etv || 0,
    paidTrafficCost: item.paid?.estimated_paid_traffic_cost || 0,
    rank: item.rank || 0,
  }

  await cacheData(cacheKey, result, 24)
  return result
}

// ─── Function 6: LLM Brand Mentions ──────────────────────────────────────────

export async function getLLMVisibility(
  brandName: string,
  _queries: string[],
): Promise<LLMVisibility[]> {
  const cacheKey = `llm_${brandName.replace(/\s+/g, '_')}`
  const cached = await getCachedData(cacheKey)
  if (cached) return cached

  const platforms = ['chatgpt', 'gemini', 'perplexity', 'copilot']
  const results: LLMVisibility[] = []

  for (const platform of platforms) {
    try {
      const data = await dfsRequest('/v3/ai_optimization/llm_mentions/live', {
        keyword: brandName,
        platform,
        location_code: 2356,
        language_code: 'en',
      })

      const items: any[] = data[0]?.result || []
      const mentions = items.filter(i =>
        i.content?.toLowerCase().includes(brandName.toLowerCase()),
      )

      results.push({
        platform,
        visibility: Math.round((mentions.length / (items.length || 1)) * 100),
        sentiment: calculateSentiment(mentions),
        topicsCount: mentions.length,
        mentionCount: mentions.length,
      })
    } catch {
      results.push({ platform, visibility: 0, sentiment: 0, topicsCount: 0, mentionCount: 0 })
    }
  }

  await cacheData(cacheKey, results, 168)
  return results
}

// ─── Function 7: Reddit Mentions ─────────────────────────────────────────────

export async function getRedditMentions(keyword: string, limit: number = 20): Promise<any[]> {
  const cacheKey = `reddit_${keyword.replace(/\s+/g, '_')}`
  const cached = await getCachedData(cacheKey)
  if (cached) return cached

  const data = await dfsRequest('/v3/social_media/reddit/live/advanced', {
    keyword,
    limit,
    sort_by: 'date',
  })

  const results = (data[0]?.result || []).map((item: any) => ({
    title: item.title,
    url: item.url,
    subreddit: item.subreddit,
    score: item.score,
    comments: item.num_comments,
    date: item.date,
    snippet: item.snippet,
  }))

  await cacheData(cacheKey, results, 6)
  return results
}
